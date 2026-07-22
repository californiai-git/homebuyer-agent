"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type SavedSearch = {
  id: string;
  name: string;
  query: string;
  maxPrice: number;
  homeType: string;
  createdAt: string;
};

export function useSavedSearches() {
  const { status } = useSession();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/saved-searches");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? "Could not load saved searches.");
      }
      setSearches(body.searches ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load saved searches.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // Intentional fetch-on-mount/deps-change, same rationale as useDriveDocuments.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const save = useCallback(async (input: { name: string; query: string; maxPrice: number; homeType: string }) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? "Could not save this search.");
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this search.");
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/saved-searches?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? "Could not delete this saved search.");
      }
      setSearches((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this saved search.");
    }
  }, []);

  return { searches, loading, saving, error, save, remove };
}
