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
