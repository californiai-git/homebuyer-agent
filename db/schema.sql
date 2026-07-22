-- Run this once against the provisioned Postgres database (Vercel dashboard
-- Storage tab -> your database -> Query, or any Postgres client) before
-- using saved searches / daily alerts.

create extension if not exists pgcrypto;

create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  owner_email text not null,
  name text not null,
  query text not null default '',
  max_price integer not null,
  home_type text not null default 'Any home',
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_owner_idx on saved_searches (owner_sub);

create table if not exists saved_search_seen_listings (
  saved_search_id uuid not null references saved_searches (id) on delete cascade,
  listing_id integer not null,
  seen_at timestamptz not null default now(),
  primary key (saved_search_id, listing_id)
);

-- Extracted numbers from a document the user chose to have analyzed (pay
-- stubs, bank statements). One row per (owner, Drive file); re-analyzing
-- the same file updates the row in place.
create table if not exists document_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  drive_file_id text not null,
  file_name text not null,
  kind text not null,
  extracted_json jsonb not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_sub, drive_file_id)
);

create index if not exists document_analyses_owner_idx on document_analyses (owner_sub);

-- Per-user affordability preference. One row per user; upserted on change.
create table if not exists financial_profiles (
  owner_sub text primary key,
  affordability_formula text not null default 'cash_flow',
  manual_override integer,
  updated_at timestamptz not null default now()
);
