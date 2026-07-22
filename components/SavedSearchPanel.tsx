"use client";

import { signIn, useSession } from "next-auth/react";
import { useSavedSearches } from "@/lib/useSavedSearches";
import { ANY_HOME_TYPE } from "@/lib/listings";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function SavedSearchPanel({
  query,
  maxPrice,
  homeType,
  onApply
}: {
  query: string;
  maxPrice: number;
  homeType: string;
  onApply: (criteria: { query: string; maxPrice: number; homeType: string }) => void;
}) {
  const { status } = useSession();
  const { searches, loading, saving, error, save, remove } = useSavedSearches();

  if (status !== "authenticated") {
    return (
      <div className="saved-searches">
        <p>Sign in with Google to save this search and get a daily email when new homes match.</p>
        <button type="button" className="search-button" onClick={() => signIn("google")}>
          Sign in with Google
        </button>
      </div>
    );
  }

  function handleSave() {
    const name = window.prompt("Name this saved search:", query || "My search");
    if (!name) return;
    save({ name, query, maxPrice, homeType });
  }

  return (
    <div className="saved-searches">
      <div className="saved-searches-header">
        <span>Saved searches</span>
        <button type="button" className="search-button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving\u2026" : "Save this search"}
        </button>
      </div>

      {error && <p className="doc-error">{error}</p>}

      {loading ? (
        <p className="doc-status">Loading saved searches…</p>
      ) : searches.length === 0 ? (
        <p className="doc-status">No saved searches yet. Set your filters above, then click &ldquo;Save this search&rdquo;.</p>
      ) : (
        <ul className="saved-search-list">
          {searches.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.homeType === ANY_HOME_TYPE ? "Any home" : item.homeType} · up to {money.format(item.maxPrice)}
                  {item.query ? ` \u00b7 "${item.query}"` : ""}
                </span>
              </div>
              <div className="saved-search-actions">
                <button
                  type="button"
                  onClick={() => onApply({ query: item.query, maxPrice: item.maxPrice, homeType: item.homeType })}
                >
                  Apply
                </button>
                <button type="button" aria-label={`Delete ${item.name}`} onClick={() => remove(item.id)}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="saved-search-hint">You&apos;ll get a daily email when new homes match a saved search.</p>
    </div>
  );
}
