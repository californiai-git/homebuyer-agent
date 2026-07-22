"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type AnalysisKind = "paystub" | "bank_statement";

export type DocumentAnalysis = {
  id: string;
  driveFileId: string;
  fileName: string;
  kind: AnalysisKind;
  extracted: Record<string, unknown>;
  model: string;
  createdAt: string;
  updatedAt: string;
};

/** Loads and mutates the current user's document analyses. */
export function useAnalyses() {
  const { status } = useSession();
  const [analyses, setAnalyses] = useState<DocumentAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (status !== "authenticated") {
      setAnalyses([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analyses");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not load analyses.");
      setAnalyses(body.analyses ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load analyses.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const analyze = useCallback(async (params: { driveFileId: string; fileName: string; kind: AnalysisKind }) => {
    setPendingId(params.driveFileId);
    setError(null);
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Analysis failed.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setPendingId(null);
    }
  }, [refresh]);

  const remove = useCallback(async (driveFileId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/analyses?driveFileId=${encodeURIComponent(driveFileId)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not remove analysis.");
      setAnalyses((current) => current.filter((a) => a.driveFileId !== driveFileId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove analysis.");
    }
  }, []);

  const byDriveFileId = new Map(analyses.map((a) => [a.driveFileId, a] as const));

  return { analyses, byDriveFileId, loading, pendingId, error, refresh, analyze, remove };
}
