import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, serverErrorResponse } from "@/lib/apiAuth";
import { getUserProfile, createUserProfile } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await requireAuth(req);

    let profile = await getUserProfile(uid);

    if (!profile) {
      // First login: create minimal profile
      await createUserProfile(uid, { email });
      profile = await getUserProfile(uid);
    }

    if (!profile) {
      return serverErrorResponse("Failed to create or fetch profile");
    }

    return NextResponse.json({
      user: profile,
      exists: true,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") return unauthorizedResponse();
    console.error("GET /api/auth/me error:", err);
    return serverErrorResponse("Unexpected error");
  }
}
