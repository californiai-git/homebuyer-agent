"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type HouseFolder = {
  id: string;
  name: string;
  webViewLink?: string;
};

/** Lists and creates per-house Drive folders (the real, persisted set - not the mock listings). */
export function useHouseFolders() {
  const { status } = useSession();
  const [houses, setHouses] = useState<HouseFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/drive/houses");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? "Could not load houses.");
      }
      setHouses(body.houses ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load houses.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // Intentional fetch-on-mount/deps-change, same rationale as useDriveDocuments.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const addHouse = useCallback(async (address: string) => {
    setAdding(true);
    setError(null);
    try {
      const response = await fetch("/api/drive/houses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? "Could not add this house.");
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this house.");
    } finally {
      setAdding(false);
    }
  }, [refresh]);

  return { houses, loading, adding, error, addHouse, refresh, signedIn: status === "authenticated" };
}
