// Server-side Firebase Admin initialization
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function initAdmin() {
  if (getApps().length > 0) {
    return { db: getFirestore(), auth: getAuth() };
  }

  // Cloud Run provides GOOGLE_APPLICATION_CREDENTIALS implicitly
  // For local dev, user can set GOOGLE_APPLICATION_CREDENTIALS env var
  initializeApp();

  return { db: getFirestore(), auth: getAuth() };
}

export const { db, auth } = initAdmin();
