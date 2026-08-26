import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse, badRequestResponse } from "@/lib/apiAuth";
import {
  getUserProfile,
  getWishlistItem,
  createDecision,
  updateWishlistItem,
  getDecisions,
  getThisMonthBoughtTotal,
  computeSavingsStreak,
} from "@/lib/db";
import { askBudgetBuddy } from "@/lib/gemini";
import { z } from "zod";

const DecisionCreateSchema = z.object({
  itemId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const decisions = await getDecisions(uid);
    const streak = await computeSavingsStreak(uid);
    return NextResponse.json({ decisions, streak });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("GET /api/decisions error:", err);
    return serverErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const body = await req.json();
    const parsed = DecisionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestResponse("Invalid decision request");
    }

    const { itemId } = parsed.data;

    const [profile, item] = await Promise.all([
      getUserProfile(uid),
      getWishlistItem(uid, itemId),
    ]);

    if (!profile || !profile.hasCompletedOnboarding) {
      return NextResponse.json({ error: "Onboarding required" }, { status: 403 });
    }

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // BUDGET STATE DIRECTIVE: Fetch real budget numbers before calling Gemini
    const totalSpent = await getThisMonthBoughtTotal(uid);
    const budget = profile.budget || profile.monthlyBudget;
    const savingsGoal = profile.savingsGoal;
    const remainingBudget = Math.max(0, budget - totalSpent);

    // Call Gemini with explicit injected values
    let geminiOutput;
    try {
      geminiOutput = await askBudgetBuddy({
        budget,
        savingsGoal,
        remainingBudget,
        totalSpent,
        itemName: item.itemName,
        price: item.price,
        description: item.description,
      });
    } catch (err: any) {
      console.error("Gemini decision error:", err);
      return NextResponse.json(
        { error: err.message || "AI service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // DECISION LOGGING DIRECTIVE: Atomically log decision and update wishlist status
    const rec = geminiOutput.recommendation;
    let newStatus: "bought" | "skipped" | "waiting" = "waiting";
    if (rec === "buy_now") newStatus = "bought";
    else if (rec === "skip") newStatus = "skipped";
    else if (rec === "wait") newStatus = "waiting";

    const decisionData = {
      itemId,
      itemName: item.itemName,
      price: item.price,
      recommendation: geminiOutput.recommendation,
      reasoning: geminiOutput.reasoning,
      isNegotiation: false,
      userPlea: "",
      compromise: "",
      remainingBudgetAtDecision: remainingBudget,
      savingsGoalAtDecision: savingsGoal,
    };

    // Atomic-ish: write both sequentially in a single request handler
    const decision = await createDecision(uid, decisionData);
    await updateWishlistItem(uid, itemId, { status: newStatus });

    return NextResponse.json({
      decision,
      recommendation: geminiOutput.recommendation,
      reasoning: geminiOutput.reasoning,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("POST /api/decisions error:", err);
    return serverErrorResponse();
  }
}
