import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse, badRequestResponse } from "@/lib/apiAuth";
import { getUserProfile, getDecisionsInRange, createDigest, getDigests } from "@/lib/db";
import { generateWeeklyDigest } from "@/lib/gemini";

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((Number(d) - Number(yearStart)) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const digests = await getDigests(uid);
    return NextResponse.json({ digests });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("GET /api/digests error:", err);
    return serverErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const profile = await getUserProfile(uid);

    if (!profile || !profile.hasCompletedOnboarding) {
      return NextResponse.json({ error: "Onboarding required" }, { status: 403 });
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const decisions = await getDecisionsInRange(uid, startOfWeek, endOfWeek);

    const itemsBought = decisions.filter((d) => d.recommendation === "buy_now" && !d.isNegotiation).length;
    const itemsSkipped = decisions.filter((d) => d.recommendation === "skip" && !d.isNegotiation).length;
    const itemsWaited = decisions.filter((d) => d.recommendation === "wait" && !d.isNegotiation).length;
    const totalSpent = decisions
      .filter((d) => d.recommendation === "buy_now" && !d.isNegotiation)
      .reduce((sum, d) => sum + d.price, 0);

    const budget = profile.budget || profile.monthlyBudget;
    const savingsGoal = profile.savingsGoal;
    const totalSaved = Math.max(0, budget - totalSpent);

    const decisionsList = decisions.length
      ? decisions.map((d) => `- ${d.itemName} ($${d.price}): ${d.recommendation}. ${d.reasoning}`).join("\n")
      : "No decisions this week.";

    let geminiOutput;
    try {
      geminiOutput = await generateWeeklyDigest({
        budget,
        savingsGoal,
        totalSpent,
        totalSaved,
        itemsBought,
        itemsSkipped,
        itemsWaited,
        decisionsList,
      });
    } catch (err: any) {
      console.error("Gemini digest error:", err);
      return NextResponse.json(
        { error: err.message || "AI service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const weekOf = getISOWeek(startOfWeek);

    const digest = await createDigest(uid, {
      weekOf,
      summaryText: geminiOutput.summaryText,
      totalSpent,
      totalSaved,
      itemsBought,
      itemsSkipped,
      itemsWaited,
    });

    return NextResponse.json({ digest });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("POST /api/digests error:", err);
    return serverErrorResponse();
  }
}
