export interface UserProfile {
  uid: string;
  budget: number;
  monthlyBudget: number;
  savingsGoal: number;
  displayName: string;
  email: string;
  photoURL: string;
  hasCompletedOnboarding: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItem {
  id: string;
  itemName: string;
  price: number;
  description?: string;
  url?: string;
  status: "pending" | "bought" | "skipped" | "waiting";
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  itemId: string;
  itemName: string;
  price: number;
  recommendation: "buy_now" | "wait" | "skip";
  reasoning: string;
  isNegotiation: boolean;
  userPlea?: string;
  compromise?: string;
  remainingBudgetAtDecision: number;
  savingsGoalAtDecision: number;
  createdAt: string;
  updatedAt: string;
}

export interface Digest {
  id: string;
  weekOf: string;
  summaryText: string;
  totalSpent: number;
  totalSaved: number;
  itemsBought: number;
  itemsSkipped: number;
  itemsWaited: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSummary {
  budget: number;
  savingsGoal: number;
  totalSpent: number;
  remainingBudget: number;
  savingsStreak: number;
}

export interface GeminiDecisionOutput {
  recommendation: "buy_now" | "wait" | "skip";
  reasoning: string;
}

export interface GeminiNegotiateOutput {
  recommendation: "buy_now" | "wait" | "skip";
  reasoning: string;
  compromise: string;
}

export interface GeminiDigestOutput {
  summaryText: string;
}
