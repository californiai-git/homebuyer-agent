import { requireSql } from "./db";
import type { SavedSearchRow } from "./db";

export type SavedSearch = {
  id: string;
  ownerEmail: string;
  name: string;
  query: string;
  maxPrice: number;
  homeType: string;
  createdAt: string;
};

function toSavedSearch(row: SavedSearchRow): SavedSearch {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    query: row.query,
    maxPrice: row.max_price,
    homeType: row.home_type,
    createdAt: row.created_at
  };
}

/** Lists one user's saved searches, newest first. */
export async function listSavedSearches(ownerSub: string): Promise<SavedSearch[]> {
  const sql = requireSql();
  const rows = (await sql`
    select id, owner_sub, owner_email, name, query, max_price, home_type, created_at
    from saved_searches
    where owner_sub = ${ownerSub}
    order by created_at desc
  `) as SavedSearchRow[];
  return rows.map(toSavedSearch);
}

/** Lists every saved search across all users - used only by the daily cron job. */
export async function listAllSavedSearches(): Promise<SavedSearch[]> {
  const sql = requireSql();
  const rows = (await sql`
    select id, owner_sub, owner_email, name, query, max_price, home_type, created_at
    from saved_searches
    order by created_at desc
  `) as SavedSearchRow[];
  return rows.map(toSavedSearch);
}

export async function createSavedSearch(params: {
  ownerSub: string;
  ownerEmail: string;
  name: string;
  query: string;
  maxPrice: number;
  homeType: string;
}): Promise<SavedSearch> {
  const sql = requireSql();
  const rows = (await sql`
    insert into saved_searches (owner_sub, owner_email, name, query, max_price, home_type)
    values (${params.ownerSub}, ${params.ownerEmail}, ${params.name}, ${params.query}, ${params.maxPrice}, ${params.homeType})
    returning id, owner_sub, owner_email, name, query, max_price, home_type, created_at
  `) as SavedSearchRow[];
  return toSavedSearch(rows[0]);
}

/** Deletes a saved search, but only if it's owned by `ownerSub`. Returns whether a row was deleted. */
export async function deleteSavedSearch(ownerSub: string, id: string): Promise<boolean> {
  const sql = requireSql();
  const rows = await sql`
    delete from saved_searches
    where id = ${id} and owner_sub = ${ownerSub}
    returning id
  `;
  return rows.length > 0;
}

export async function getSeenListingIds(savedSearchId: string): Promise<Set<number>> {
  const sql = requireSql();
  const rows = (await sql`
    select listing_id from saved_search_seen_listings where saved_search_id = ${savedSearchId}
  `) as { listing_id: number }[];
  return new Set(rows.map((row) => row.listing_id));
}

/** Records listing ids as already-seen for a saved search, so they aren't re-alerted tomorrow. */
export async function markListingsSeen(savedSearchId: string, listingIds: number[]): Promise<void> {
  const sql = requireSql();
  for (const listingId of listingIds) {
    await sql`
      insert into saved_search_seen_listings (saved_search_id, listing_id)
      values (${savedSearchId}, ${listingId})
      on conflict (saved_search_id, listing_id) do nothing
    `;
  }
}
