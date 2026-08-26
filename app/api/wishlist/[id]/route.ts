import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse, badRequestResponse } from "@/lib/apiAuth";
import { updateWishlistItem, deleteWishlistItem, getWishlistItem } from "@/lib/db";
import { z } from "zod";

const WishlistUpdateSchema = z.object({
  itemName: z.string().min(1).max(200).optional(),
  price: z.number().positive().optional(),
  description: z.string().max(1000).optional(),
  url: z.string().url().max(500).optional().or(z.literal("")),
  status: z.enum(["pending", "bought", "skipped", "waiting"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireAuth(req);
    const { id } = await params;

    const item = await getWishlistItem(uid, id);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = WishlistUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestResponse("Invalid update data");
    }

    await updateWishlistItem(uid, id, parsed.data);
    const updated = await getWishlistItem(uid, id);
    return NextResponse.json({ item: updated });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("PATCH /api/wishlist/[id] error:", err);
    return serverErrorResponse();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireAuth(req);
    const { id } = await params;

    const item = await getWishlistItem(uid, id);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await deleteWishlistItem(uid, id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("DELETE /api/wishlist/[id] error:", err);
    return serverErrorResponse();
  }
}
