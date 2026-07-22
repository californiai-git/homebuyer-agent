import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

async function main() {
  if (!connectionString) {
    console.error("DATABASE_URL (or POSTGRES_URL) is not set.");
    process.exitCode = 1;
    return;
  }

  const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  const client = new Client(connectionString);
  await client.connect();
  try {
    await client.query(schema);
    console.log("Schema applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to apply schema:", error);
  process.exitCode = 1;
});
