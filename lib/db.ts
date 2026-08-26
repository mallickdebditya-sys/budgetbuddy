import { db } from "./firebaseAdmin";
import {
  WishlistItem,
  Decision,
  Digest,
  UserProfile,
} from "./types";

// Users
const usersCol = (uid: string) => db.collection("users").doc(uid);

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await usersCol(uid).collection("profile").doc("data").get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  return {
    uid,
    budget: data.budget ?? 0,
    monthlyBudget: data.monthlyBudget ?? 0,
    savingsGoal: data.savingsGoal ?? 0,
    displayName: data.displayName ?? "",
    email: data.email ?? "",
    photoURL: data.photoURL ?? "",
    hasCompletedOnboarding: data.hasCompletedOnboarding ?? false,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? "",
  };
}

export async function createUserProfile(uid: string, data: {
  email: string;
  displayName?: string;
  photoURL?: string;
}) {
  const now = new Date();
  const profileRef = usersCol(uid).collection("profile").doc("data");
  const payload = {
    email: data.email,
    displayName: data.displayName ?? "",
    photoURL: data.photoURL ?? "",
    budget: 0,
    monthlyBudget: 0,
    savingsGoal: 0,
    hasCompletedOnboarding: false,
    createdAt: now,
    updatedAt: now,
  };
  await profileRef.set(payload, { merge: true });
  return payload;
}

export async function updateOnboarding(uid: string, budget: number, savingsGoal: number) {
  const now = new Date();
  const profileRef = usersCol(uid).collection("profile").doc("data");
  await profileRef.update({
    budget,
    monthlyBudget: budget,
    savingsGoal,
    hasCompletedOnboarding: true,
    updatedAt: now,
  });
}

// Wishlist
const wishlistCol = (uid: string) => usersCol(uid).collection("wishlist");

export async function getWishlist(uid: string): Promise<WishlistItem[]> {
  const snap = await wishlistCol(uid).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? "",
    updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? "",
  }));
}

export async function createWishlistItem(uid: string, data: Omit<WishlistItem, "id" | "createdAt" | "updatedAt">): Promise<WishlistItem> {
  const now = new Date();
  const ref = wishlistCol(uid).doc();
  const payload = { ...data, createdAt: now, updatedAt: now };
  await ref.set(payload);
  return { id: ref.id, ...data, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export async function updateWishlistItem(uid: string, id: string, data: Partial<Omit<WishlistItem, "id" | "createdAt" | "updatedAt">>) {
  const now = new Date();
  const ref = wishlistCol(uid).doc(id);
  await ref.update({ ...data, updatedAt: now });
}

export async function getWishlistItem(uid: string, id: string): Promise<WishlistItem | null> {
  const snap = await wishlistCol(uid).doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { id: snap.id, ...d, createdAt: d.createdAt?.toDate?.()?.toISOString() ?? "", updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? "" } as WishlistItem;
}

export async function deleteWishlistItem(uid: string, id: string) {
  await wishlistCol(uid).doc(id).delete();
}

// Decisions
const decisionsCol = (uid: string) => usersCol(uid).collection("decisions");

export async function getDecisions(uid: string): Promise<Decision[]> {
  const snap = await decisionsCol(uid).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? "",
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? "",
    } as Decision;
  });
}

export async function createDecision(uid: string, data: Omit<Decision, "id" | "createdAt" | "updatedAt">): Promise<Decision> {
  const now = new Date();
  const ref = decisionsCol(uid).doc();
  const payload = { ...data, createdAt: now, updatedAt: now };
  await ref.set(payload);
  return { id: ref.id, ...data, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export async function getLatestDecisionForItem(uid: string, itemId: string): Promise<Decision | null> {
  const snap = await decisionsCol(uid)
    .where("itemId", "==", itemId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? "",
  } as Decision;
}

// Digests
const digestsCol = (uid: string) => usersCol(uid).collection("digests");

export async function getDigests(uid: string): Promise<Digest[]> {
  const snap = await digestsCol(uid).orderBy("weekOf", "desc").get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? "",
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? "",
    } as Digest;
  });
}

export async function createDigest(uid: string, data: Omit<Digest, "id" | "createdAt" | "updatedAt">): Promise<Digest> {
  const now = new Date();
  const ref = digestsCol(uid).doc();
  const payload = { ...data, createdAt: now, updatedAt: now };
  await ref.set(payload);
  return { id: ref.id, ...data, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

// Budget / Spending Helpers
export async function getThisMonthBoughtTotal(uid: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const snap = await wishlistCol(uid)
    .where("status", "==", "bought")
    .where("updatedAt", ">=", startOfMonth)
    .where("updatedAt", "<", endOfMonth)
    .get();

  let total = 0;
  snap.docs.forEach((d) => {
    total += d.data().price ?? 0;
  });
  return total;
}

export async function computeSavingsStreak(uid: string): Promise<number> {
  // Streak = consecutive weeks where total saved > 0 (we approximate by checking decisions)
  // For simplicity: count continuous weeks with at least one "skip" or "wait" and zero "buy_now"?
  // Simpler heuristic: look at last 4 decisions; if they're all skip/wait, streak = 4.
  const snap = await decisionsCol(uid).orderBy("createdAt", "desc").limit(20).get();
  let streak = 0;
  for (const d of snap.docs) {
    const rec = d.data().recommendation;
    if (rec === "buy_now" && !d.data().isNegotiation) break;
    if (rec === "skip" || rec === "wait") streak++;
    else if (rec === "buy_now" && d.data().isNegotiation) streak++; // negotiation that still recommended wait counts as discipline
  }
  return streak;
}

export async function getDecisionsInRange(uid: string, start: Date, end: Date): Promise<Decision[]> {
  const snap = await decisionsCol(uid)
    .where("createdAt", ">=", start)
    .where("createdAt", "<=", end)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? "",
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? "",
    } as Decision;
  });
}
