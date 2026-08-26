"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { signInWithGoogle, logout } from "@/lib/firebase";
import { Skeleton } from "@/app/components/Skeleton";
import { Onboarding } from "@/app/components/Onboarding";
import { Dashboard } from "@/app/components/Dashboard";
import { SpendingView } from "@/app/components/SpendingView";
import { DigestView } from "@/app/components/DigestView";
import { UserProfile } from "@/lib/types";

export default function Home() {
  const { user, loading, idToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"dashboard" | "spending" | "digest">("dashboard");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function fetchProfile() {
    if (!idToken) return;
    setCheckingProfile(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.user);
      } else {
        setError(data.error || "Failed to load profile");
      }
    } catch {
      setError("Network error");
    } finally {
      setCheckingProfile(false);
    }
  }

  useEffect(() => {
    if (idToken) {
      fetchProfile();
    } else {
      setProfile(null);
      setCheckingProfile(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  if (!mounted) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <h1 className="text-2xl font-extrabold text-emerald-700 mb-2">BudgetBuddy</h1>
        <p className="text-sm text-slate-500">Loading...</p>
      </main>
    );
  }

  if (loading || checkingProfile) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-4 w-72" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <h1 className="text-4xl font-extrabold text-emerald-700 mb-2">BudgetBuddy</h1>
        <p className="text-slate-600 mb-8 max-w-sm">
          Your AI shopping agent that helps you stay on budget.
        </p>
        <button
          onClick={() => signInWithGoogle()}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          Sign in with Google
        </button>
        {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
      </main>
    );
  }

  if (profile && !profile.hasCompletedOnboarding) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <Onboarding
          idToken={idToken!}
          onComplete={() => fetchProfile()}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-emerald-700">BudgetBuddy</span>
          {user.photoURL ? (
            <img src={user.photoURL} alt="avatar" className="h-8 w-8 rounded-full" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold">
              {user.displayName?.[0] || "U"}
            </div>
          )}
        </div>
        <button
          onClick={() => logout()}
          className="text-sm text-slate-600 hover:text-slate-800"
        >
          Sign Out
        </button>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6 py-2 flex gap-2">
        {(["dashboard", "spending", "digest"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t === "dashboard" && "Dashboard"}
            {t === "spending" && "Spending"}
            {t === "digest" && "Digest"}
          </button>
        ))}
      </nav>

      <section className="p-6 max-w-5xl mx-auto">
        {tab === "dashboard" && (
          <Dashboard idToken={idToken!} profile={profile!} />
        )}
        {tab === "spending" && (
          <SpendingView idToken={idToken!} />
        )}
        {tab === "digest" && (
          <DigestView idToken={idToken!} />
        )}
      </section>
    </main>
  );
}
