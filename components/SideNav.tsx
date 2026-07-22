"use client";

import { signIn, useSession } from "next-auth/react";
import DocumentSection from "./DocumentSection";
import SavedSearchPanel from "./SavedSearchPanel";
import { useHouseFolders } from "@/lib/useHouseFolders";

/**
 * Persistent left nav: common documents, one entry per real house folder
 * (from Drive, not the mock listings), and saved searches - the single home
 * for everything tied to the signed-in user's own data.
 */
export default function SideNav({
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
  const { houses, loading, adding, error, addHouse } = useHouseFolders();

  function handleAddHouse() {
    const address = window.prompt("House address:");
    if (!address) return;
    addHouse(address.trim());
  }

  return (
    <aside className="side-nav">
      <p className="side-nav-eyebrow">Your documents</p>

      <DocumentSection title="Common documents" scope="common" defaultOpen />

      <p className="side-nav-group-label">Houses</p>
      {status === "authenticated" && loading && <p className="doc-status">Loading houses\u2026</p>}
      {houses.map((house) => (
        <DocumentSection key={house.id} title={house.name} scope="house" address={house.name} />
      ))}
      {error && <p className="doc-error">{error}</p>}
      {status === "authenticated" ? (
        <button type="button" className="nav-add-house" onClick={handleAddHouse} disabled={adding}>
          {adding ? "Adding\u2026" : "+ Add house"}
        </button>
      ) : (
        <button type="button" className="nav-add-house" onClick={() => signIn("google")}>
          Sign in to add a house
        </button>
      )}

      <p className="side-nav-group-label">Saved searches</p>
      <SavedSearchPanel query={query} maxPrice={maxPrice} homeType={homeType} onApply={onApply} />
    </aside>
  );
}
