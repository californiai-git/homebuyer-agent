/**
 * Upload policy for documents stored in a user's Google Drive.
 *
 * These files never touch our own storage or get served back by our
 * server (they are streamed straight through to Google Drive and viewed
 * afterwards through Google's own Drive UI), so this check is mainly about
 * a sane product experience rather than a code-execution boundary. It still
 * enforces the size/type limits called for in the storage architecture doc.
 */

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_DOCUMENT_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
]);

/** Returns a user-facing error message, or `null` when the file is acceptable. */
export function validateDocumentFile(file: File): string | null {
  if (file.size <= 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return `Files must be ${Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB or smaller.`;
  }

  if (file.type && !ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
    return "Unsupported file type. Upload a PDF, image, Word, Excel, or text document.";
  }

  return null;
}
