import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse, badRequestResponse } from "@/lib/apiAuth";
import { updateWishlistItem, getWishlistItem, createDecision, getThisMonthBoughtTotal } from "@/lib/db";
import { z } from "zod";

const ResolveSchema = z.object({
  itemId: z.string().min(1),
  decision: z.enum(["buy", "skip", "wait"]),
});

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const body = await req.json();
    const parsed = ResolveSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestResponse("Invalid resolve request");
    }

    const { itemId, decision: userDecision } = parsed.data;

    const item = await getWishlistItem(uid, itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    let status: "bought" | "skipped" | "waiting" = "waiting";
    if (userDecision === "buy") status = "bought";
    else if (userDecision === "skip") status = "skipped";
    else if (userDecision === "wait") status = "waiting";

    const totalSpent = await getThisMonthBoughtTotal(uid);
    const remainingBudget = Math.max(0, (item.price || 0) - totalSpent); // placeholder

    // Log user override as a decision
    await createDecision(uid, {
      itemId,
      itemName: item.itemName,
      price: item.price,
      recommendation: userDecision === "buy" ? "buy_now" : userDecision === "skip" ? "skip" : "wait",
      reasoning: `User manually resolved to "${userDecision}"`,
      isNegotiation: false,
      userPlea: "",
      compromise: "",
      remainingBudgetAtDecision: 0,
      savingsGoalAtDecision: 0,
    });

    await updateWishlistItem(uid, itemId, { status });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("POST /api/decisions/resolve error:", err);
    return serverErrorResponse();
  }
}
