"use client";

import React, { useState } from "react";

interface OnboardingProps {
  idToken: string;
  onComplete: () => void;
}

export function Onboarding({ idToken, onComplete }: OnboardingProps) {
  const [budget, setBudget] = useState<string>("");
  const [savingsGoal, setSavingsGoal] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const budgetNum = Number(budget);
    const savingsNum = Number(savingsGoal);

    if (!budgetNum || budgetNum <= 0) {
      setError("Monthly budget must be a positive number");
      return;
    }
    if (savingsNum < 0) {
      setError("Savings goal cannot be negative");
      return;
    }
    if (savingsNum >= budgetNum) {
      setError("Savings goal must be less than budget");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ budget: budgetNum, savingsGoal: savingsNum }),
      });
      const data = await res.json();
      if (res.ok) {
        onComplete();
      } else {
        setError(data.error || "Failed to complete onboarding");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Welcome to BudgetBuddy</h2>
      <p className="text-sm text-slate-600 mb-6">
        Set your monthly budget and savings goal to get started.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="budget" className="block text-sm font-medium text-slate-700 mb-1">
            Monthly Budget
          </label>
          <input
            id="budget"
            type="number"
            min="1"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 2000"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label htmlFor="savingsGoal" className="block text-sm font-medium text-slate-700 mb-1">
            Savings Goal
          </label>
          <input
            id="savingsGoal"
            type="number"
            min="0"
            step="0.01"
            value={savingsGoal}
            onChange={(e) => setSavingsGoal(e.target.value)}
            placeholder="e.g. 500"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
