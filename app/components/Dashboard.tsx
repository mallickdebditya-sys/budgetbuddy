"use client";

import React, { useEffect, useState, useCallback } from "react";
import { WishlistItem, UserProfile, Decision } from "@/lib/types";
import { Skeleton } from "./Skeleton";

interface DashboardProps {
  idToken: string;
  profile: UserProfile;
}

interface RecCard {
  itemId: string;
  itemName: string;
  recommendation: "buy_now" | "wait" | "skip";
  reasoning: string;
  compromise?: string;
}

export function Dashboard({ idToken, profile }: DashboardProps) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const [recCard, setRecCard] = useState<RecCard | null>(null);
  const [asking, setAsking] = useState(false);

  const [plea, setPlea] = useState("");
  const [negotiating, setNegotiating] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    setError(null);
    try {
      const res = await fetch("/api/wishlist", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
      } else {
        setError(data.error || "Failed to load wishlist");
      }
    } catch {
      setError("Network error loading wishlist");
    } finally {
      setLoadingItems(false);
    }
  }, [idToken]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNum = Number(price);
    if (!itemName.trim() || !priceNum || priceNum <= 0) {
      setError("Item name and a positive price are required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          itemName: itemName.trim(),
          price: priceNum,
          description: description.trim() || undefined,
          url: url.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setItemName("");
        setPrice("");
        setDescription("");
        setUrl("");
        fetchItems();
      } else {
        setError(data.error || "Failed to add item");
      }
    } catch {
      setError("Network error adding item");
    } finally {
      setAdding(false);
    }
  }

  async function handleAsk(item: WishlistItem) {
    setError(null);
    setAsking(true);
    setRecCard(null);
    setPlea("");
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecCard({
          itemId: item.id,
          itemName: item.itemName,
          recommendation: data.recommendation,
          reasoning: data.reasoning,
        });
        fetchItems();
      } else {
        setError(data.error || "Failed to get recommendation");
      }
    } catch {
      setError("Network error getting recommendation");
    } finally {
      setAsking(false);
    }
  }

  async function handleNegotiate() {
    if (!recCard) return;
    if (!plea.trim()) {
      setError("Please enter your plea");
      return;
    }
    setError(null);
    setNegotiating(true);
    try {
      const res = await fetch("/api/decisions/negotiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ itemId: recCard.itemId, userPlea: plea.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecCard({
          ...recCard,
          recommendation: data.recommendation,
          reasoning: data.reasoning,
          compromise: data.compromise,
        });
      } else {
        setError(data.error || "Negotiation failed");
      }
    } catch {
      setError("Network error during negotiation");
    } finally {
      setNegotiating(false);
    }
  }

  async function handleResolve(itemId: string, decision: "buy" | "skip" | "wait") {
    setError(null);
    try {
      const res = await fetch("/api/decisions/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ itemId, decision }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecCard((prev) => (prev && prev.itemId === itemId ? null : prev));
        fetchItems();
      } else {
        setError(data.error || "Failed to resolve item");
      }
    } catch {
      setError("Network error resolving item");
    }
  }

  function closeRecCard() {
    setRecCard(null);
    setPlea("");
  }

  const statusBadge = (status: WishlistItem["status"]) => {
    const map: Record<string, string> = {
      pending: "bg-slate-100 text-slate-700",
      bought: "bg-emerald-100 text-emerald-700",
      skipped: "bg-rose-100 text-rose-700",
      waiting: "bg-amber-100 text-amber-700",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || map.pending}`}>
        {status}
      </span>
    );
  };

  const recLabel = (rec: RecCard["recommendation"]) => {
    if (rec === "buy_now") return "Buy Now";
    if (rec === "wait") return "Wait";
    return "Skip";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Add Wishlist Item</h3>
        <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <label htmlFor="itemName" className="block text-sm font-medium text-slate-700 mb-1">
              Name
            </label>
            <input
              id="itemName"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Noise-cancelling headphones"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label htmlFor="price" className="block text-sm font-medium text-slate-700 mb-1">
              Price
            </label>
            <input
              id="price"
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 149.99"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
              Description (optional)
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="url" className="block text-sm font-medium text-slate-700 mb-1">
              URL (optional)
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {adding ? "Adding..." : "Add Item"}
            </button>
            {error && !recCard && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Wishlist</h3>
        {loadingItems && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!loadingItems && items.length === 0 && (
          <p className="text-sm text-slate-500">Your wishlist is empty. Add an item above.</p>
        )}
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800 truncate">{item.itemName}</span>
                  {statusBadge(item.status)}
                </div>
                <p className="text-sm text-slate-600">${item.price.toFixed(2)}</p>
                {item.description && (
                  <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:underline mt-1 inline-block break-all"
                  >
                    {item.url}
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.status === "pending" && (
                  <button
                    onClick={() => handleAsk(item)}
                    disabled={asking}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {asking && recCard?.itemId !== item.id ? "Processing..." : "Ask BudgetBuddy"}
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolve(item.id, "buy")}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Bought
                  </button>
                  <button
                    onClick={() => handleResolve(item.id, "skip")}
                    className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  >
                    Skipped
                  </button>
                  <button
                    onClick={() => handleResolve(item.id, "wait")}
                    className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                  >
                    Waiting
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {recCard && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-800">
              Recommendation: {recLabel(recCard.recommendation)}
            </h3>
            <button
              onClick={closeRecCard}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          <p className="text-sm text-slate-700 mb-4">{recCard.reasoning}</p>

          {recCard.compromise && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 mb-4">
              <p className="text-xs font-semibold text-indigo-700 mb-1">Compromise</p>
              <p className="text-sm text-indigo-800">{recCard.compromise}</p>
            </div>
          )}

          {recCard.recommendation !== "buy_now" && (
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="plea" className="block text-sm font-medium text-slate-700 mb-1">
                  But I really want it
                </label>
                <textarea
                  id="plea"
                  value={plea}
                  onChange={(e) => setPlea(e.target.value)}
                  placeholder="Tell BudgetBuddy why you really want this..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={handleNegotiate}
                disabled={negotiating}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-fit"
              >
                {negotiating ? "Negotiating..." : "Submit Plea"}
              </button>
            </div>
          )}

          {error && recCard && (
            <p className="text-sm text-red-600 mt-3">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
