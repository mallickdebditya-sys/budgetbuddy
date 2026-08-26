import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse, badRequestResponse } from "@/lib/apiAuth";
import {
  getUserProfile,
  getWishlistItem,
  createDecision,
  getLatestDecisionForItem,
  getThisMonthBoughtTotal,
} from "@/lib/db";
import { negotiateBudgetBuddy } from "@/lib/gemini";
import { z } from "zod";

const NegotiateSchema = z.object({
  itemId: z.string().min(1),
  userPlea: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const body = await req.json();
    const parsed = NegotiateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestResponse("Invalid negotiation request");
    }

    const { itemId, userPlea } = parsed.data;

    const [profile, item, previousDecision] = await Promise.all([
      getUserProfile(uid),
      getWishlistItem(uid, itemId),
      getLatestDecisionForItem(uid, itemId),
    ]);

    if (!profile || !profile.hasCompletedOnboarding) {
      return NextResponse.json({ error: "Onboarding required" }, { status: 403 });
    }

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (!previousDecision) {
      return badRequestResponse("No previous decision found for this item");
    }

    // BUDGET STATE DIRECTIVE: Fetch real budget numbers before calling Gemini
    const totalSpent = await getThisMonthBoughtTotal(uid);
    const budget = profile.budget || profile.monthlyBudget;
    const savingsGoal = profile.savingsGoal;
    const remainingBudget = Math.max(0, budget - totalSpent);

    // Call Gemini with negotiation context
    let geminiOutput;
    try {
      geminiOutput = await negotiateBudgetBuddy({
        budget,
        savingsGoal,
        remainingBudget,
        itemName: item.itemName,
        price: item.price,
        previousRecommendation: previousDecision.recommendation,
        previousReasoning: previousDecision.reasoning,
        userPlea,
      });
    } catch (err: any) {
      console.error("Gemini negotiate error:", err);
      return NextResponse.json(
        { error: err.message || "AI service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // DECISION LOGGING DIRECTIVE: Log negotiation atomically
    const decisionData = {
      itemId,
      itemName: item.itemName,
      price: item.price,
      recommendation: geminiOutput.recommendation,
      reasoning: geminiOutput.reasoning,
      isNegotiation: true,
      userPlea,
      compromise: geminiOutput.compromise,
      remainingBudgetAtDecision: remainingBudget,
      savingsGoalAtDecision: savingsGoal,
    };

    const decision = await createDecision(uid, decisionData);

    return NextResponse.json({
      decision,
      recommendation: geminiOutput.recommendation,
      reasoning: geminiOutput.reasoning,
      compromise: geminiOutput.compromise,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("POST /api/decisions/negotiate error:", err);
    return serverErrorResponse();
  }
}
