import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse } from "@/lib/apiAuth";
import { getUserProfile, getThisMonthBoughtTotal, computeSavingsStreak } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const profile = await getUserProfile(uid);

    if (!profile || !profile.hasCompletedOnboarding) {
      return NextResponse.json({ error: "Onboarding required" }, { status: 403 });
    }

    const budget = profile.budget || profile.monthlyBudget;
    const savingsGoal = profile.savingsGoal;
    const totalSpent = await getThisMonthBoughtTotal(uid);
    const remainingBudget = Math.max(0, budget - totalSpent);
    const savingsStreak = await computeSavingsStreak(uid);

    return NextResponse.json({
      budget,
      savingsGoal,
      totalSpent,
      remainingBudget,
      savingsStreak,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("GET /api/budget error:", err);
    return serverErrorResponse();
  }
}
