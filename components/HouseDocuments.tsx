"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useDriveDocuments } from "@/lib/useDriveDocuments";
import DocumentList from "./DocumentList";

export default function HouseDocuments({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const { status } = useSession();
  const { documents, loading, uploading, error, upload, remove } = useDriveDocuments("house", address, open);

  return (
    <div className="house-documents">
      <button type="button" className="doc-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? "Hide disclosures & documents" : "Disclosures & documents"}
      </button>

      {open && (
        <div className="doc-panel">
          {status !== "authenticated" ? (
            <>
              <p>Sign in with Google to store disclosures for this address in your own Drive.</p>
              <button type="button" className="search-button" onClick={() => signIn("google")}>
                Sign in with Google
              </button>
            </>
          ) : (
            <>
              <label className="doc-upload">
                {uploading ? "Uploading…" : "Upload disclosure"}
                <input
                  type="file"
                  hidden
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {error && <p className="doc-error">{error}</p>}
              <DocumentList documents={documents} loading={loading} onDelete={remove} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
