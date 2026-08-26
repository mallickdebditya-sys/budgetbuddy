import { NextRequest, NextResponse } from "next/server";
import { auth } from "./firebaseAdmin";

export async function requireAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const idToken = authHeader.replace("Bearer ", "");
  const decoded = await auth.verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email ?? "" };
}

export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function badRequestResponse(message = "Bad Request") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverErrorResponse(message = "Server Error") {
  return NextResponse.json({ error: message }, { status: 500 });
}
