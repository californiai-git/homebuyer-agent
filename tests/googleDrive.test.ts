import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeDriveQueryValue, normalizeHouseFolderName } from "../lib/googleDrive";

test("escapeDriveQueryValue escapes single quotes so folder names cannot break Drive queries", () => {
  assert.equal(escapeDriveQueryValue("123 O'Brien Ave"), "123 O\\'Brien Ave");
});

test("escapeDriveQueryValue escapes backslashes before quotes", () => {
  assert.equal(escapeDriveQueryValue("a\\b'c"), "a\\\\b\\'c");
});

test("escapeDriveQueryValue leaves ordinary text untouched", () => {
  assert.equal(escapeDriveQueryValue("1842 Maple Grove Lane"), "1842 Maple Grove Lane");
});

test("normalizeHouseFolderName trims and collapses internal whitespace", () => {
  assert.equal(normalizeHouseFolderName("  1842   Maple Grove Lane  "), "1842 Maple Grove Lane");
});

test("normalizeHouseFolderName rejects an empty address", () => {
  assert.throws(() => normalizeHouseFolderName("   "), RangeError);
});

test("normalizeHouseFolderName caps extremely long addresses", () => {
  const long = "A".repeat(500);
  assert.equal(normalizeHouseFolderName(long).length, 200);
});
