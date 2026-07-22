import { test } from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES, validateDocumentFile } from "../lib/documentPolicy";

function makeFile(bytes: number, type: string, name = "document"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

test("validateDocumentFile accepts a normal PDF", () => {
  assert.equal(validateDocumentFile(makeFile(1024, "application/pdf")), null);
});

test("validateDocumentFile rejects an empty file", () => {
  assert.match(validateDocumentFile(makeFile(0, "application/pdf")) ?? "", /empty/i);
});

test("validateDocumentFile rejects files over the size limit", () => {
  const message = validateDocumentFile(makeFile(MAX_DOCUMENT_BYTES + 1, "application/pdf"));
  assert.match(message ?? "", /smaller/i);
});

test("validateDocumentFile rejects a disallowed mime type", () => {
  const message = validateDocumentFile(makeFile(1024, "application/x-msdownload"));
  assert.match(message ?? "", /unsupported file type/i);
});

test("every allowed mime type is accepted", () => {
  for (const type of ALLOWED_DOCUMENT_MIME_TYPES) {
    assert.equal(validateDocumentFile(makeFile(1024, type)), null, `expected ${type} to be accepted`);
  }
});
