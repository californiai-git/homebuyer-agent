"use client";

import { useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useDriveDocuments } from "@/lib/useDriveDocuments";
import DocumentList from "./DocumentList";

export default function CommonDocuments() {
  const { status } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const { documents, loading, uploading, error, upload, remove } = useDriveDocuments("common", undefined, true);

  return (
    <section className="documents" id="documents">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your financial documents</p>
          <h2>Common documents</h2>
        </div>
        {status === "authenticated" && (
          <button type="button" className="search-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload document"}
          </button>
        )}
      </div>

      {status !== "authenticated" ? (
        <div className="empty">
          <h3>Sign in with Google to store documents</h3>
          <p>
            Preapprovals, bank statements, and income documents are saved to a private
            &ldquo;homebuyer-agent&rdquo; folder in your own Google Drive &mdash; not on our servers.
          </p>
          <button type="button" className="search-button" onClick={() => signIn("google")}>
            Sign in with Google
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            hidden
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
    </section>
  );
}
