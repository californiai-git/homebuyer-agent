"use client";

import { useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useDriveDocuments } from "@/lib/useDriveDocuments";
import DocumentList from "./DocumentList";

/**
 * One accordion row in the left nav: a title, a toggle, and (when open) the
 * document list + upload control for either the shared "common" folder or a
 * single house's folder. Replaces the old separate CommonDocuments /
 * HouseDocuments components with one implementation.
 */
export default function DocumentSection({
  title,
  scope,
  address,
  defaultOpen = false
}: {
  title: string;
  scope: "common" | "house";
  address?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { status } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const { documents, loading, uploading, error, upload, remove } = useDriveDocuments(scope, address, open);

  return (
    <div className="nav-section">
      <button type="button" className="nav-section-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{title}</span>
        <span className="nav-section-chevron">{open ? "\u2212" : "+"}</span>
      </button>

      {open && (
        <div className="nav-section-panel">
          {status !== "authenticated" ? (
            <>
              <p>Sign in with Google to manage documents.</p>
              <button type="button" className="doc-upload" onClick={() => signIn("google")}>
                Sign in with Google
              </button>
            </>
          ) : (
            <>
              <button type="button" className="doc-upload" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading\u2026" : "Upload document"}
              </button>
              <input
                ref={inputRef}
                type="file"
                hidden
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload(file);
                  event.target.value = "";
                }}
              />
              {error && <p className="doc-error">{error}</p>}
              <DocumentList documents={documents} loading={loading} onDelete={remove} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
