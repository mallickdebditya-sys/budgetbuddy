# BudgetBuddy

AI shopping agent that helps you decide whether to buy items on your wishlist based on your live budget. Uses the Gemini API for reasoning and Firebase/Firestore for auth + persistence.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (Route Handlers), deployed on Cloud Run
- **Auth**: Firebase Authentication (Google Sign-In only)
- **DB**: Cloud Firestore with owner-isolated security rules
- **AI**: Gemini API via `@google/genai` (free-tier Flash models only)
- **Secrets**: Google Cloud Secret Manager

## Prerequisites

- Node.js 20+
- A Firebase project with Authentication (Google provider) and Firestore enabled
- A GCP project with the Gemini API enabled and a `GEMINI_API_KEY` stored in Secret Manager
- `gcloud` CLI and `firebase` CLI installed and authenticated

## Environment Setup

1. Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:...

GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLOUD_PROJECT=your_gcp_project_id
FIREBASE_PROJECT_ID=your_firebase_project_id
```

For local server-side Firebase Admin initialization, either:
- Run in a GCP environment (Cloud Run / Cloud Shell / GCE) where Application Default Credentials are available, OR
- Set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON with `roles/firebaseauth.admin` and `roles/datastore.user`.

## Running Locally

```bash
cd budgetbuddy
npm install
npm run dev
```

Open http://localhost:3000.

The dev server runs both frontend and API routes on the same port.

## Firestore Security Rules

Deploy with:

```bash
firebase deploy --only firestore:rules
```

Rules enforce `request.auth.uid == userId` on every path so users can only read/write their own `/users/{uid}` subtree.

## Secret Manager

Create the secret once:

```bash
gcloud secrets create GEMINI_API_KEY --data-file=/dev/stdin <<< "YOUR_GEMINI_KEY"
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_CLOUD_RUN_SA@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Build and Deploy to Cloud Run

```bash
# Set project
gcloud config set project YOUR_GCP_PROJECT_ID

# Build and push image
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/budgetbuddy-api

# Deploy service
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
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design, data models, API routes, and Gemini call flows.

## Testing

See [TESTING.md](TESTING.md) for the manual test walkthrough.

## Key Directives

- **Budget State**: Before any Gemini recommendation, the backend fetches the user's real `remainingBudget` and `savingsGoal` from Firestore and injects them into the prompt.
- **Decision Logging**: Every recommendation is atomically written to `/decisions` together with the wishlist item update so the user never sees a recommendation that diverges from stored history.
- **Free Tier Only**: We only call Gemini Flash models (`gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`, `gemini-3.7-flash`). No Pro models are used.
