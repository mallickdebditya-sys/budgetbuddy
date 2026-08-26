import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse, badRequestResponse } from "@/lib/apiAuth";
import { updateOnboarding } from "@/lib/db";
import { z } from "zod";

const OnboardSchema = z.object({
  budget: z.number().positive(),
  savingsGoal: z.number().nonnegative(),
});

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);

    const body = await req.json();
    const parsed = OnboardSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestResponse("Invalid onboarding data");
    }

    const { budget, savingsGoal } = parsed.data;

    if (savingsGoal >= budget) {
      return badRequestResponse("Savings goal must be less than budget");
    }

    await updateOnboarding(uid, budget, savingsGoal);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("POST /api/auth/onboard error:", err);
    return serverErrorResponse("Unexpected error");
  }
}
