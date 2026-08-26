"use client";

import React, { useEffect, useState, useCallback } from "react";
import { BudgetSummary, Decision } from "@/lib/types";
import { Skeleton } from "./Skeleton";

interface SpendingViewProps {
  idToken: string;
}

export function SpendingView({ idToken }: SpendingViewProps) {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [budgetRes, decisionsRes] = await Promise.all([
        fetch("/api/budget", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/decisions", { headers: { Authorization: `Bearer ${idToken}` } }),
      ]);
      const budgetData = await budgetRes.json();
      const decisionsData = await decisionsRes.json();

      if (budgetRes.ok) {
        setBudget(budgetData);
      } else {
        setError(budgetData.error || "Failed to load budget");
      }

      if (decisionsRes.ok) {
        setDecisions(decisionsData.decisions || []);
      } else {
        setError(decisionsData.error || "Failed to load decisions");
      }
    } catch {
      setError("Network error loading data");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const progressPercent =
    budget && budget.budget > 0
      ? Math.min(100, Math.max(0, ((budget.budget - budget.remainingBudget) / budget.budget) * 100))
      : 0;

  const recLabel = (rec: Decision["recommendation"]) => {
    if (rec === "buy_now") return "Buy Now";
    if (rec === "wait") return "Wait";
    return "Skip";
  };

  return (
    <div className="flex flex-col gap-6">
      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && budget && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Budget</h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Remaining</span>
            <span className="text-sm font-semibold text-slate-800">
              ${budget.remainingBudget.toFixed(2)} / ${budget.budget.toFixed(2)}
            </span>
          </div>
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span>Spent: ${budget.totalSpent.toFixed(2)}</span>
            <span>Savings Goal: ${budget.savingsGoal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {!loading && budget && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Savings Streak</h3>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-extrabold text-emerald-700">{budget.savingsStreak}</span>
            <span className="text-sm text-slate-600">week{budget.savingsStreak === 1 ? "" : "s"} saved</span>
          </div>
        </div>
      )}

      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Decision History</h3>
          {decisions.length === 0 ? (
            <p className="text-sm text-slate-500">No decisions yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {decisions.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800">{d.itemName}</span>
                    <span className="text-xs font-medium text-slate-500">${d.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.recommendation === "buy_now"
                          ? "bg-emerald-100 text-emerald-700"
                          : d.recommendation === "wait"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {recLabel(d.recommendation)}
                    </span>
                    {d.isNegotiation && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">
                        Negotiation
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{d.reasoning}</p>
                  {d.compromise && (
                    <div className="mt-2 rounded-md bg-indigo-50 border border-indigo-100 p-2">
                      <p className="text-xs font-semibold text-indigo-700">Compromise</p>
                      <p className="text-sm text-indigo-800">{d.compromise}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
