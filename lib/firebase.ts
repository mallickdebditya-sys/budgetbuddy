// Client-side Firebase initialization (Browser only)
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

let app: FirebaseApp | undefined;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
}

function initClientFirebase() {
  if (typeof window === "undefined") return undefined;
  const config = getFirebaseConfig();
  if (!config.apiKey) {
    // Will be set at runtime in browser via env vars
    return undefined;
  }
  if (getApps().length === 0) {
    app = initializeApp(config);
  } else {
    app = getApps()[0];
  }
  return app;
}

initClientFirebase();

export const auth = typeof window !== "undefined" && app ? getAuth(app) : (null as any);
export const db = typeof window !== "undefined" && app ? getFirestore(app) : (null as any);
export const googleProvider = typeof window !== "undefined" && app ? new GoogleAuthProvider() : (null as any);

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase not initialized");
  return signInWithPopup(auth, googleProvider);
}

export async function logout() {
  if (!auth) throw new Error("Firebase not initialized");
  return signOut(auth);
}
