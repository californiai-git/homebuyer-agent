"use client";

import { useEffect, useRef, useState } from "react";
import type { Listing, SearchCriteria } from "./listings";

/**
 * Fetches listings for the current search criteria, debounced so typing in
 * the "Where" box doesn't fire a request per keystroke.
 */
export function useListings(criteria: SearchCriteria) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams({
        query: criteria.query,
        maxPrice: String(criteria.maxPrice),
        homeType: criteria.homeType
      });
      if (criteria.comfortable) params.set("comfortable", String(criteria.comfortable));

      setLoading(true);
      setError(null);

      fetch(`/api/listings?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error ?? "Could not load listings.");
          return body as { listings: Listing[]; provider: string };
        })
        .then((body) => {
          if (controller.signal.aborted) return;
          setListings(body.listings ?? []);
          setProvider(body.provider ?? "");
        })
        .catch((caught) => {
          if (controller.signal.aborted) return;
          setError(caught instanceof Error ? caught.message : "Could not load listings.");
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [criteria.query, criteria.maxPrice, criteria.homeType, criteria.comfortable]);

  return { listings, provider, loading, error };
}
