# BudgetBuddy — Manual Test Walkthrough

Run through these steps to verify the application works end-to-end.

---

## 1. Landing Page

1. Open the app URL.
2. **Expected**: You see the BudgetBuddy landing page with a "Sign in with Google" button.
3. No other auth options (password fields, email input) are present.

---

## 2. Google Sign-In

1. Click "Sign in with Google".
2. Select a Google account in the popup.
3. **Expected**: You are redirected to the app, now signed in, and the user avatar appears in the top-right.
4. Open browser DevTools → Application → Local Storage. **Expected**: No sensitive tokens are stored in plain text; Firebase handles auth state internally.

---

## 3. Onboarding (First Login)

1. If this is the first time signing in, the app shows the Onboarding screen.
2. Enter a Monthly Budget (e.g. `2000`) and a Savings Goal (e.g. `500`).
3. Click "Continue".
4. **Expected**: The onboarding screen disappears and you are on the Dashboard.
5. **Validation**: Try entering a savings goal greater than or equal to the budget. **Expected**: Inline error message appears and form does not submit.

---

## 4. Sign Out

1. Click "Sign Out" in the header.
2. **Expected**: You are returned to the landing page.
3. **Validation**: Try opening `/api/wishlist` directly without an auth token. **Expected**: `401 Unauthorized` response.

---

## 5. Add Wishlist Item

1. Sign back in with Google.
2. On the Dashboard, fill in the "Add Wishlist Item" form:
   - Name: "Mechanical Keyboard"
   - Price: `89.99`
   - Description (optional): "Keychron K2"
   - URL (optional): [Amazon link]
3. Click "Add Item".
4. **Expected**: The new item appears at the top of the Wishlist list with a `pending` badge.
5. **Validation**: Try adding an item with a negative price or no name. **Expected**: Inline error.

---

## 6. Get Recommendation ("Ask BudgetBuddy")

1. Find the item you just added with status `pending`.
2. Click "Ask BudgetBuddy".
3. **Expected**: After a short loading state, a recommendation card appears with one of:
   - **Buy Now** (green badge)
   - **Wait** (amber badge)
   - **Skip** (rose badge)
4. The card shows 1–2 sentences of reasoning referencing the actual remaining budget.
5. **Validation**: Check Firestore `/users/{uid}/decisions`. **Expected**: A new decision document exists with `recommendation`, `reasoning`, `remainingBudgetAtDecision`, and `savingsGoalAtDecision` matching the live numbers.
6. Check the wishlist item status. **Expected**: It updated to `bought`, `skipped`, or `waiting` matching the recommendation.

---

## 7. Negotiation ("But I really want it")

1. If the recommendation is **not** "Buy Now", the recommendation card shows a "Submit Plea" textarea.
2. Type: `"but I really want it"` and click "Submit Plea".
3. **Expected**: A new recommendation appears with a compromise (e.g. "Wait 7 days", "Set aside $15/week", or "Consider a cheaper alternative").
4. The card shows a "Negotiation" tag.
5. **Validation**: Check Firestore `/users/{uid}/decisions`. **Expected**: A second decision document exists for the same `itemId` with `isNegotiation: true`, `userPlea` populated, and a `compromise` string.

---

## 8. View History

1. Click the "Spending" tab.
2. **Expected**: 
   - Budget bar shows remaining vs total budget.
   - Savings Streak counter shows a number.
   - Decision History list shows all recommendations and negotiations with reasoning text visible.
3. **Validation**: If you marked an item as "Bought", the budget bar should reflect the spent amount.

---

## 9. Budget Bar Updates After "Bought"

1. Go back to Dashboard.
2. Add another cheap item (e.g. `price = 5`).
3. Click "Bought" directly (without asking BudgetBuddy).
4. Go to Spending tab.
5. **Expected**: The budget bar spent amount increased by $5, and remaining budget decreased by $5.

---

## 10. Weekly Digest Generation

1. Click the "Digest" tab.
2. Click "Generate Weekly Digest".
3. **Expected**: After a short delay, a new digest card appears with:
   - A natural-language summary paragraph
   - Spent / Saved / Bought / Skipped / Waited stats
4. **Validation**: Check Firestore `/users/{uid}/digests`. **Expected**: A new digest document exists with `summaryText`, `weekOf`, and correct counts.
5. Click "Generate Weekly Digest" again.
6. **Expected**: A second digest card appears (possibly for the same week, depending on timing).

---

## 11. Cross-User Isolation

1. Sign out.
2. Sign in with a **different** Google account (Account B).
3. **Expected**: Account B sees an empty wishlist, empty history, and budget onboarding prompt (if first login).
4. Add an item for Account B.
5. **Expected**: Account A cannot see Account B's item, and vice versa.
6. **Validation**: In Firestore, verify `/users/{accountA_uid}` and `/users/{accountB_uid}` have separate, non-overlapping subcollections.

---

## 12. Gemini Fallback / Error Handling

1. Temporarily provide an invalid `GEMINI_API_KEY` env var and restart the server.
2. Try "Ask BudgetBuddy".
3. **Expected**: The user sees an error: "AI service temporarily unavailable. Please try again later." (status 503) after the ladder exhausts all models.

---

*End of walkthrough.*
