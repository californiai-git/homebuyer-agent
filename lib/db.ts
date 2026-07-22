import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn("DATABASE_URL (or POSTGRES_URL) is not set; saved searches and daily alerts are disabled.");
}

/** Tagged-template SQL client, or `null` if no database is configured yet. */
export const sql = connectionString ? neon(connectionString) : null;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("Database is not configured. Set DATABASE_URL (or POSTGRES_URL).");
  }
}

/** Returns the SQL client, throwing a clear error if no database is configured. */
export function requireSql() {
  if (!sql) {
    throw new DatabaseNotConfiguredError();
  }
  return sql;
}

/** Maps a thrown database error to a safe JSON response, logging unexpected failures. */
export function dbErrorResponse(error: unknown): NextResponse {
  if (error instanceof DatabaseNotConfiguredError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  console.error("Unexpected database error", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export type SavedSearchRow = {
  id: string;
  owner_sub: string;
  owner_email: string;
  name: string;
  query: string;
  max_price: number;
  home_type: string;
  created_at: string;
};
