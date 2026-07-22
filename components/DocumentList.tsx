"use client";

import type { DriveDocument } from "@/lib/useDriveDocuments";
import type { AnalysisKind, DocumentAnalysis } from "@/lib/useAnalyses";

function formatSize(size?: string): string {
  if (!size) return "";
  const bytes = Number(size);
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function summarizeAnalysis(a: DocumentAnalysis): string {
  const values = a.extracted as Record<string, unknown>;
  if (a.kind === "paystub") {
    const gross = typeof values.grossPay === "number" ? values.grossPay : null;
    const freq = typeof values.payFrequency === "string" ? values.payFrequency : "";
    if (gross && freq && freq !== "unknown") return `${money.format(gross)} gross · ${freq}`;
    if (gross) return `${money.format(gross)} gross`;
    return "Analyzed";
  }
  const outflows = typeof values.recurringOutflowsMonthly === "number" ? values.recurringOutflowsMonthly : null;
  if (outflows) return `~${money.format(outflows)}/mo recurring outflows`;
  return "Analyzed";
}

export default function DocumentList({
  documents,
  loading,
  onDelete,
  analysesByFileId,
  pendingAnalysisId,
  onAnalyze,
  onRemoveAnalysis
}: {
  documents: DriveDocument[];
  loading: boolean;
  onDelete?: (fileId: string) => void;
  analysesByFileId?: Map<string, DocumentAnalysis>;
  pendingAnalysisId?: string | null;
  onAnalyze?: (params: { driveFileId: string; fileName: string; kind: AnalysisKind }) => void;
  onRemoveAnalysis?: (driveFileId: string) => void;
}) {
  if (loading) {
    return <p className="doc-status">Loading documents…</p>;
  }

  if (documents.length === 0) {
    return <p className="doc-status">No documents yet.</p>;
  }

  return (
    <ul className="doc-list">
      {documents.map((doc) => {
        const analysis = analysesByFileId?.get(doc.id);
        const pending = pendingAnalysisId === doc.id;
        const canAnalyze = onAnalyze && doc.mimeType === "application/pdf";

        return (
          <li key={doc.id} className="doc-item">
            <div className="doc-item-row">
              <a href={doc.webViewLink} target="_blank" rel="noreferrer noopener">
                {doc.name}
              </a>
              <span>{formatSize(doc.size)}</span>
              {onDelete && (
                <button type="button" aria-label={`Delete ${doc.name}`} onClick={() => onDelete(doc.id)}>
                  ×
                </button>
              )}
            </div>

            {canAnalyze && !analysis && (
              <div className="doc-item-actions">
                <button
                  type="button"
                  className="doc-analyze"
                  disabled={pending}
                  onClick={() => onAnalyze?.({ driveFileId: doc.id, fileName: doc.name, kind: "paystub" })}
                >
                  {pending ? "Analyzing…" : "Analyze as pay stub"}
                </button>
                <button
                  type="button"
                  className="doc-analyze"
                  disabled={pending}
                  onClick={() => onAnalyze?.({ driveFileId: doc.id, fileName: doc.name, kind: "bank_statement" })}
                >
                  {pending ? "Analyzing…" : "Analyze as bank statement"}
                </button>
              </div>
            )}

            {analysis && (
              <div className="doc-item-analysis">
                <span className={`doc-analysis-badge doc-analysis-${analysis.kind}`}>
                  {analysis.kind === "paystub" ? "Pay stub" : "Bank statement"}
                </span>
                <span>{summarizeAnalysis(analysis)}</span>
                {onRemoveAnalysis && (
                  <button type="button" className="doc-analysis-clear" onClick={() => onRemoveAnalysis(analysis.driveFileId)}>
                    Re-analyze
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
