"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type AffordabilitySnapshot = {
  formula: "cash_flow" | "28_percent";
  manualOverride: number | null;
  comfortable: number;
  comfortableByRule28: number | null;
  comfortableByCashFlow: number | null;
  grossMonthlyIncome: number | null;
  monthlyExpenses: number | null;
  paystubCount: number;
  bankStatementCount: number;
};

const DEFAULT_SNAPSHOT: AffordabilitySnapshot = {
  formula: "cash_flow",
  manualOverride: null,
  comfortable: 4200,
  comfortableByRule28: null,
  comfortableByCashFlow: null,
  grossMonthlyIncome: null,
  monthlyExpenses: null,
  paystubCount: 0,
  bankStatementCount: 0
};

export function useAffordability() {
  const { status } = useSession();
  const [snapshot, setSnapshot] = useState<AffordabilitySnapshot>(DEFAULT_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (status !== "authenticated") {
      setSnapshot(DEFAULT_SNAPSHOT);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/affordability");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not load your plan.");
      setSnapshot(body.affordability ?? DEFAULT_SNAPSHOT);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your plan.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const update = useCallback(async (patch: { formula?: AffordabilitySnapshot["formula"]; manualOverride?: number | null }) => {
    setError(null);
    try {
      const response = await fetch("/api/affordability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not update your plan.");
      setSnapshot(body.affordability ?? DEFAULT_SNAPSHOT);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your plan.");
    }
  }, []);

  return { snapshot, loading, error, refresh, update };
}
