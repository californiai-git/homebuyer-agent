"use client";

import type { DriveDocument } from "@/lib/useDriveDocuments";

function formatSize(size?: string): string {
  if (!size) return "";
  const bytes = Number(size);
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentList({
  documents,
  loading,
  onDelete
}: {
  documents: DriveDocument[];
  loading: boolean;
  onDelete?: (fileId: string) => void;
}) {
  if (loading) {
    return <p className="doc-status">Loading documents…</p>;
  }

  if (documents.length === 0) {
    return <p className="doc-status">No documents yet.</p>;
  }

  return (
    <ul className="doc-list">
      {documents.map((doc) => (
        <li key={doc.id}>
          <a href={doc.webViewLink} target="_blank" rel="noreferrer noopener">
            {doc.name}
          </a>
          <span>{formatSize(doc.size)}</span>
          {onDelete && (
            <button type="button" aria-label={`Delete ${doc.name}`} onClick={() => onDelete(doc.id)}>
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
