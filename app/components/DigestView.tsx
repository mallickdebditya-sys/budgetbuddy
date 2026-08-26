"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Digest } from "@/lib/types";
import { Skeleton } from "./Skeleton";

interface DigestViewProps {
  idToken: string;
}

export function DigestView({ idToken }: DigestViewProps) {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDigests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/digests", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setDigests(data.digests || []);
      } else {
        setError(data.error || "Failed to load digests");
      }
    } catch {
      setError("Network error loading digests");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    fetchDigests();
  }, [fetchDigests]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/digests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setDigests((prev) => [data.digest, ...prev]);
      } else {
        setError(data.error || "Failed to generate digest");
      }
    } catch {
      setError("Network error generating digest");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Weekly Digest</h3>
          <p className="text-sm text-slate-600 mt-1">
            Generate a personalized weekly summary powered by AI.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
        >
          {generating ? "Generating..." : "Generate Weekly Digest"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!loading && digests.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-sm text-slate-500">
          No digests yet. Click the button above to generate your first weekly digest.
        </div>
      )}

      {!loading && digests.length > 0 && (
        <div className="flex flex-col gap-4">
          {digests.map((digest) => (
            <div
              key={digest.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-slate-800">Week {digest.weekOf}</h4>
                <span className="text-xs text-slate-500">
                  {new Date(digest.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-line">{digest.summaryText}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="rounded-md bg-slate-100 px-2 py-1">
                  Spent: ${digest.totalSpent.toFixed(2)}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1">
                  Saved: ${digest.totalSaved.toFixed(2)}
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">
                  Bought: {digest.itemsBought}
                </span>
                <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">
                  Skipped: {digest.itemsSkipped}
                </span>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">
                  Waited: {digest.itemsWaited}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
