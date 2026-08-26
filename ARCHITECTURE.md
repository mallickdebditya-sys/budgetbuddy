# BudgetBuddy — Architecture Documentation

> **Status:** Complete — This document is updated whenever data models, routes, or major flows change.

---

## 1. System Overview

BudgetBuddy is an AI-powered shopping agent that helps users make purchase decisions based on their live budget. It uses Firebase Authentication for sign-in, Cloud Firestore for persistence, and the Gemini API for reasoning.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js 14 (App Router)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │    Auth      │  │   Dashboard  │  │   Spending/Digest   │   │
│  │ (Google SSO) │  │ (Wishlist,   │  │  (Budget bar,       │   │
│  │              │  │  Ask Buddy,  │  │   History, Streak,  │   │
│  │              │  │  Negotiate)  │  │   Weekly Digest)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘   │
│         │                 │                     │              │
│         │  Next.js Client │                     │              │
│         │  Components     │                     │              │
│         └─────────────────┴─────────────────────┘              │
│                           │                                      │
│  ┌────────────────────────┼────────────────────────────────────┐ │
│  │   Route Handlers       ▼                                   │ │
│  │   (API routes in /app/api/...)                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐ │ │
│  │  │    Auth      │  │  Wishlist    │  │    Gemini Bridge    │ │ │
│  │  │ Middleware   │  │   Routes     │  │   (Recommend,      │ │ │
│  │  │ (Verify JWT) │  │              │  │    Negotiate,       │ │ │
│  │  │              │  │              │  │    Weekly Digest)   │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘ │ │
│  │         │                 │                     │            │ │
│  │         └─────────────────┴─────────────────────┘            │ │
│  │                           │                                  │ │
│  └───────────────────────────┼──────────────────────────────────┘ │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │
        ┌──────────────────────┼───────────────────┐
        ▼                      ▼                   ▼
┌──────────────┐   ┌─────────────────┐   ┌──────────────┐
│  Firebase    │   │   Gemini API     │   │ Cloud Secret │
│  Firestore   │   │  (Flash models)  │   │   Manager    │
│              │   │                  │   │              │
│  /users/{uid}│   │  Free tier only  │   │ GEMINI_API_  │
│  /wishlist   │   │  No Pro models   │   │    KEY       │
│  /decisions  │   │                  │   │              │
│  /digests    │   │                  │   │              │
└──────────────┘   └─────────────────┘   └──────────────┘
```

---

## 2. Data Model

### Firestore Collections

```
/users/{uid}
  └── profile/{documentId}
        ├─ budget: number                // Monthly budget in dollars (e.g. 500)
        ├─ monthlyBudget: number          // Alias for budget, kept in sync
        ├─ savingsGoal: number             // Monthly savings target (e.g. 100)
        ├─ displayName: string             // From Google Auth
        ├─ email: string                   // From Google Auth
        ├─ photoURL: string                // From Google Auth
        ├─ hasCompletedOnboarding: boolean
        ├─ createdAt: Timestamp
        └─ updatedAt: Timestamp

  └── wishlist/{itemId}
        ├─ itemName: string                // e.g. "Mechanical Keyboard"
        ├─ price: number                   // e.g. 89.99
        ├─ description: string             // Optional notes
        ├─ url: string                     // Optional product URL
        ├─ status: "pending" | "bought" | "skipped" | "waiting"
        ├─ createdAt: Timestamp
        └─ updatedAt: Timestamp

  └── decisions/{decisionId}
        ├─ itemId: string                  // FK to wishlist item
        ├─ itemName: string                // Denormalized for display
        ├─ price: number                   // Denormalized
        ├─ recommendation: "buy_now" | "wait" | "skip"
        ├─ reasoning: string               // Natural language explanation
        ├─ isNegotiation: boolean          // True if this is a negotiation turn
        ├─ userPlea: string                // "I really want it" or similar
        ├─ compromise: string              // e.g. "wait 7 days", "save $10/week"
        ├─ remainingBudgetAtDecision: number
        ├─ savingsGoalAtDecision: number
        ├─ createdAt: Timestamp
        └─ updatedAt: Timestamp

  └── digests/{digestId}
        ├─ weekOf: string                  // ISO week string, e.g. "2026-W35"
        ├─ summaryText: string             // Gemini-generated natural language
        ├─ totalSpent: number              // Sum from decisions that week
        ├─ totalSaved: number              // Budget - totalSpent
        ├─ itemsBought: number
        ├─ itemsSkipped: number
        ├─ itemsWaited: number
        ├─ createdAt: Timestamp
        └─ updatedAt: Timestamp
```

### Denormalization Notes
- `decisions` duplicates `itemName` and `price` from `wishlist` to support history display even if the wishlist item is later deleted.
- `remainingBudgetAtDecision` is a snapshot at decision time, not live. The live remaining budget is computed on demand.

---

## 3. Auth Flow

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    User     │───▶│  Google SSO  │───▶│ Firebase Auth │───▶│   Firestore  │
│   Clicks    │    │   Sign-In    │    │   ID Token    │    │   profile    │
│  Sign-In    │    │   Popup      │    │   (JWT)       │    │  (create if  │
│             │    │              │    │               │    │  not exists) │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

1. User clicks "Sign in with Google" on the client.
2. `firebase/auth` opens a Google OAuth popup.
3. On success, Firebase returns a Firebase ID Token (JWT).
4. The client sends this token as an `Authorization: Bearer <idToken>` header on every API request.
5. Backend middleware (`verifyIdToken`) validates the JWT using Firebase Admin SDK.
6. If the user doc does not exist in Firestore, the backend creates a minimal profile with `hasCompletedOnboarding: false`.
7. If `hasCompletedOnboarding` is false, the frontend shows the Onboarding component.

### Auth Middleware
```typescript
// Every API route uses this middleware
async function requireAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.replace('Bearer ', '');
  const decoded = await adminAuth.verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email };
}
```

### No Password Fields
- Only Google Sign-In is supported. There are no password, email/password, or anonymous auth flows anywhere in the codebase.

---

## 4. API Routes

All routes require `Authorization: Bearer <Firebase ID Token>`.
All routes return JSON. Errors use `{ error: string, code?: string }`.

| # | Method | Path | Auth | Request Body | Response |
|---|--------|------|------|--------------|----------|
| 1 | `GET` | `/api/auth/me` | Yes | — | `{ user: UserProfile, exists: boolean }` |
| 2 | `POST` | `/api/auth/onboard` | Yes | `{ budget: number, savingsGoal: number }` | `{ success: true }` |
| 3 | `GET` | `/api/wishlist` | Yes | — | `{ items: WishlistItem[] }` |
| 4 | `POST` | `/api/wishlist` | Yes | `{ itemName: string, price: number, description?: string, url?: string }` | `{ item: WishlistItem }` |
| 5 | `PATCH` | `/api/wishlist/[id]` | Yes | `{ status?: "pending" \| "bought" \| "skipped" \| "waiting", itemName?: string, price?: number, description?: string, url?: string }` | `{ item: WishlistItem }` |
| 6 | `DELETE` | `/api/wishlist/[id]` | Yes | — | `{ success: true }` |
| 7 | `POST` | `/api/decisions` | Yes | `{ itemId: string }` | `{ decision: Decision, recommendation: string, reasoning: string }` |
| 8 | `POST` | `/api/decisions/negotiate` | Yes | `{ itemId: string, userPlea: string }` | `{ decision: Decision, recommendation: string, reasoning: string, compromise: string }` |
| 9 | `GET` | `/api/decisions` | Yes | — | `{ decisions: Decision[], streak: number }` |
| 10 | `POST` | `/api/decisions/resolve` | Yes | `{ itemId: string, decision: "buy" \| "skip" \| "wait" }` | `{ success: true }` |
| 11 | `GET` | `/api/budget` | Yes | — | `{ budget: number, savingsGoal: number, totalSpent: number, remainingBudget: number, savingsStreak: number }` |
| 12 | `POST` | `/api/digests` | Yes | — | `{ digest: Digest }` |
| 13 | `GET` | `/api/digests` | Yes | — | `{ digests: Digest[] }` |

### Route Details

#### POST /api/decisions
Called when user clicks "Ask BudgetBuddy" for a wishlist item.
1. Fetch user's `budget` and `savingsGoal` from Firestore.
2. Compute `remainingBudget = budget - SUM(bought items this month)` — **NO GUESSING.**
3. Inject real numbers into the Gemini prompt.
4. Write the recommendation + reasoning atomically to `/decisions` AND update wishlist `status`.
5. Return the decision to the client.

#### POST /api/decisions/negotiate
Called when user says "but I really want it."
1. Fetch the same context as `/api/decisions`.
2. Fetch the previous decision for this item.
3. Inject context + previous reasoning + user plea into Gemini.
4. Gemini returns a compromise.
5. Write the negotiation turn atomically to `/decisions` (`isNegotiation: true`).

#### POST /api/digests
Called manually via the "Generate Weekly Digest" button.
1. Fetch ALL decisions from the past 7 days.
2. Compute totals (spent, saved, counts).
3. Summarize in a structured prompt.
4. Gemini returns a natural-language paragraph.
5. Save to `/digests`.

---

## 5. Gemini Call Flow

### Pre-Call Context Fetch (MANDATORY)

Before ANY Gemini call that produces a purchase recommendation, the backend performs:

1. **Fetch user profile** from `/users/{uid}/profile` → `budget`, `savingsGoal`.
2. **Fetch all bought wishlist items** from `/users/{uid}/wishlist` where `status === "bought"` and `updatedAt` is within current month.
3. **Compute live remainingBudget**: `budget - SUM(price of bought items this month)`.
4. **Fetch wishlist item** being evaluated: `itemName`, `price`, `description`.

These exact numbers are injected into the prompt via template literals. The model never guesses the budget.

### Prompt Template (Decision)

```
You are BudgetBuddy, a friendly but firm shopping agent.

USER CONTEXT (facts from database — do not change these numbers):
- Monthly budget: $${budget}
- Savings goal: $${savingsGoal}
- Remaining budget this month: $${remainingBudget}
- Already spent this month: $${totalSpent}

WISHLIST ITEM:
- Name: ${itemName}
- Price: $${price}
- Description: ${description}

INSTRUCTIONS:
Recommend exactly ONE of: "buy_now", "wait", "skip".
Provide 1-2 sentences of reasoning referencing the actual budget numbers.
If "wait", suggest a specific timeframe.

Return ONLY valid JSON in this exact shape:
{
  "recommendation": "buy_now|wait|skip",
  "reasoning": "..."
}
```

### Prompt Template (Negotiation)

```
You are BudgetBuddy.

USER CONTEXT (facts — immutable):
- Monthly budget: $${budget}
- Savings goal: $${savingsGoal}
- Remaining budget: $${remainingBudget}

ITEM:
- Name: ${itemName}
- Price: $${price}

PREVIOUS RECOMMENDATION: "${previousRecommendation}"
PREVIOUS REASONING: "${previousReasoning}"

USER PLEA: "${userPlea}"

INSTRUCTIONS:
The user is pushing back. Propose a compromise: wait X days, suggest a cheaper alternative, or propose a temporary "sinking fund" plan (set aside $Y/week). Be firm but kind. Do NOT recommend buying if remainingBudget < price and it would break the savings goal.

Return ONLY valid JSON:
{
  "recommendation": "buy_now|wait|skip",
  "reasoning": "...",
  "compromise": "..."
}
```

### Prompt Template (Weekly Digest)

```
You are BudgetBuddy writing a weekly spending summary for your user.

FACTS (do not invent numbers):
- Starting budget: $${budget}
- Savings goal: $${savingsGoal}
- Total spent this week: $${totalSpent}
- Total saved: $${totalSaved}
- Items bought: ${itemsBought}
- Items skipped: ${itemsSkipped}
- Items waited on: ${itemsWaited}

RECENT DECISIONS:
${decisionsList}

Write a short, encouraging 3-5 sentence summary. Highlight whether they met their savings goal. Do not use markdown headers. Use plain text.

Return ONLY valid JSON:
{
  "summaryText": "..."
}
```

---

## 6. Fallback Ladder + Error Handling Matrix

### Model Fallback Ladder (FREE TIER ONLY)

All Gemini calls use the following priority:

1. **Primary**: `gemini-3.6-flash`
2. **Fallback 1**: `gemini-3.1-flash-lite`
3. **Fallback 2**: `gemini-flash-latest`
4. **Fallback 3**: `gemini-3.7-flash`

**NO Pro models are called anywhere.** This keeps cost at $0 (free tier Flash quota).

### Implementation Pattern

```typescript
const MODEL_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];

async function callGeminiWithFallback<T>(prompt: string, responseSchema: object) {
  for (const model of MODEL_LADDER) {
    try {
      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema },
      });
      if (!result.text) throw new Error("Empty response");
      return JSON.parse(result.text) as T;
    } catch (err) {
      if (isQuotaOrModelError(err)) continue; // try next model
      if (isParseError(err) && maxRetries > 0) return callGeminiWithFallback<T>(prompt, schema, maxRetries - 1);
      throw err; // re-throw on non-retryable errors
    }
  }
  throw new Error("All Gemini models exhausted.");
}
```

### Error Handling Matrix

| Scenario | API Behavior | Frontend Behavior |
|----------|-----------|-------------------|
| Gemini API 429 / quota exceeded on primary | Try next model in ladder. If all fail, return `503` with `error: "AI service temporarily unavailable. Please try again later."` | Show error + "Try Again" button |
| Gemini returns invalid JSON (parse failure) | Log raw response. Return `502` with `error: "Unexpected AI response. Please retry."` | Show error + retry button |
| Gemini returns JSON with wrong shape (zod failure) | Log. Return `502` with same message. | Same as above |
| Firestore read failure | Return `500` with `error: "Database error."` | Generic error toast |
| Auth token missing / invalid | Return `401` with `error: "Unauthorized"` | Redirect to sign-in |
| User profile missing (onboarding not done) | Return `403` with `error: "Onboarding required"` | Show Onboarding screen |
| Wishlist item not found | Return `404` with `error: "Item not found"` | Show "Item not found" message |

---

## 7. Deployment

### Cloud Run Service

- **Service name**: `budgetbuddy-api`
- **Region**: `us-central1` (or user preference)
- **Platform**: Cloud Run (fully managed)
- **Timeout**: 60s (Gemini calls can be slow)
- **Memory**: 512 MiB
- **CPU**: 1
- **Concurrency**: 80
- **Min instances**: 0 (cold start acceptable for MVP)
- **Max instances**: 5

### Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Env | GCP project ID |
| `GEMINI_API_KEY` | Secret Manager | Referenced via `projects/.../secrets/GEMINI_API_KEY/versions/latest` |
| `FIREBASE_PROJECT_ID` | Env | Firebase project ID (usually same as GCP) |

### Secret Manager Binding

The Cloud Run service account must have:
- `roles/secretmanager.secretAccessor` on the secret `GEMINI_API_KEY`.

The secret is mounted as an env var at deploy time:
```bash
gcloud run services update budgetbuddy-api \
  --update-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### Firestore Security Rules

Deployed via `firebase deploy --only firestore:rules`.
Rules enforce owner-isolation (`request.auth.uid == userId` on every path). See README.md for the full rule set.

---

## 8. How to Run Locally

### Prerequisites
1. Node.js 20+
2. A Firebase project with:
   - Authentication enabled (Google provider)
   - Firestore Database created in Native mode
   - A Web app registered (to get `firebaseConfig`)
3. A GCP project with:
   - Gemini API enabled (Google AI Studio API key)
   - Secret Manager secret `GEMINI_API_KEY` created (or set in `.env.local` for local dev)
   - `gcloud` CLI authenticated

### Step-by-Step

```bash
# 1. Clone repo
cd budgetbuddy

# 2. Install dependencies
npm install

# 3. Create environment files
cp .env.local.example .env.local
# Fill in all values

# 4. Run the Next.js dev server
npm run dev
# Open http://localhost:3000
```

The dev server runs both frontend and API routes on the same port.

---

## 9. How to Deploy

### Prerequisites
- `gcloud` CLI authenticated to target project
- `firebase` CLI authenticated
- Docker installed (or use Cloud Build)

### Deploy Steps

```bash
# 1. Set project
gcloud config set project YOUR_GCP_PROJECT_ID

# 2. Build and push container image
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/budgetbuddy-api

# 3. Deploy to Cloud Run
gcloud run deploy budgetbuddy-api \
  --image gcr.io/YOUR_GCP_PROJECT_ID/budgetbuddy-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=YOUR_GCP_PROJECT_ID" \
  --set-env-vars "FIREBASE_PROJECT_ID=YOUR_GCP_PROJECT_ID" \
  --update-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --timeout 60s \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --max-instances 5 \
  --min-instances 0 \
  --labels dev-tutorial=cloud-run-ai-challenge

# 4. Deploy Firestore rules and indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 10. Security Posture

- **Threat model**: Multi-tenant per-user data; unauthorized read/write of another user's budget/decisions is the primary risk.
- **Mitigation**: Firestore security rules enforce `request.auth.uid == userId` on every path. Backend middleware double-checks auth on every API route.
- **Secrets**: `GEMINI_API_KEY` is never logged, never sent to the client, and only injected server-side via Secret Manager.
- **OWASP**: Input validation via Zod on all API bodies. No SQL injection (NoSQL with no dynamic query construction). XSS mitigated by React escaping + no `dangerouslySetInnerHTML`.
- **Reviewer persona**: All changes are reviewed for budget context injection correctness (must fetch real budget before each Gemini call) and atomic decision logging.

---

## 11. File Layout

```
budgetbuddy/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── me/route.ts
│   │   │   └── onboard/route.ts
│   │   ├── budget/route.ts
│   │   ├── decisions/
│   │   │   ├── route.ts
│   │   │   ├── negotiate/route.ts
│   │   │   └── resolve/route.ts
│   │   ├── digests/route.ts
│   │   └── wishlist/
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── DigestView.tsx
│   │   ├── Onboarding.tsx
│   │   ├── Skeleton.tsx
│   │   └── SpendingView.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── apiAuth.ts
│   ├── authContext.tsx
│   ├── db.ts
│   ├── firebase.ts
│   ├── firebaseAdmin.ts
│   ├── gemini.ts
│   ├── types.ts
│   └── utils.ts
├── public/
├── .env.local.example
├── .firebaserc
├── Dockerfile
├── firestore.indexes.json
├── firestore.rules
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── README.md
├── TESTING.md
├── ARCHITECTURE.md
└── tsconfig.json
```

---

*Last updated: 2026-08-27 — Implementation complete. Next.js App Router used for both frontend and API routes. Build passes successfully.*
