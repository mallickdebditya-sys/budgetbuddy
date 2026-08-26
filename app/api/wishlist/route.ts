import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse, badRequestResponse } from "@/lib/apiAuth";
import { getWishlist, createWishlistItem, getUserProfile } from "@/lib/db";
import { z } from "zod";

const WishlistCreateSchema = z.object({
  itemName: z.string().min(1).max(200),
  price: z.number().positive(),
  description: z.string().max(1000).optional(),
  url: z.string().url().max(500).optional().or(z.literal("")),
});

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const items = await getWishlist(uid);
    return NextResponse.json({ items });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("GET /api/wishlist error:", err);
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

    const body = await req.json();
    const parsed = WishlistCreateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestResponse("Invalid wishlist item data");
    }

    const { itemName, price, description, url } = parsed.data;

    const item = await createWishlistItem(uid, {
      itemName,
      price,
      description: description || "",
      url: url || "",
      status: "pending",
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("POST /api/wishlist error:", err);
    return serverErrorResponse();
  }
}
