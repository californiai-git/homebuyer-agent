"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type DriveDocument = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
};

type DriveScope = "common" | "house";

/**
 * Loads, uploads to, and deletes from a user's Google Drive document folder.
 * `scope: "common"` targets the shared financial-documents folder; `scope:
 * "house"` targets the per-address disclosures folder for `address`.
 */
export function useDriveDocuments(scope: DriveScope, address: string | undefined, enabled: boolean) {
  const { status } = useSession();
  const [documents, setDocuments] = useState<DriveDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (status !== "authenticated" || !enabled) return;
    if (scope === "house" && !address) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope });
      if (scope === "house" && address) params.set("address", address);

      const response = await fetch(`/api/drive/documents?${params.toString()}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? "Could not load documents.");
      }
      setDocuments(body.files ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, [status, enabled, scope, address]);

  useEffect(() => {
    // Intentional fetch-on-mount/deps-change: `refresh` sets loading/error
    // state as part of an async Drive request, which is the standard data
    // fetching Effect pattern (https://react.dev/learn/synchronizing-with-effects#fetching-data).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const upload = useCallback(async (file: File) => {
    if (scope === "house" && !address) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("scope", scope);
      if (scope === "house" && address) form.set("address", address);
      form.set("file", file);

      const response = await fetch("/api/drive/documents", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? "Upload failed.");
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [scope, address, refresh]);

  const remove = useCallback(async (fileId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/drive/documents?fileId=${encodeURIComponent(fileId)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? "Could not delete the document.");
      }
      setDocuments((current) => current.filter((doc) => doc.id !== fileId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the document.");
    }
  }, []);

  return {
    documents,
    loading,
    uploading,
    error,
    upload,
    remove,
    refresh,
    signedIn: status === "authenticated"
  };
}
