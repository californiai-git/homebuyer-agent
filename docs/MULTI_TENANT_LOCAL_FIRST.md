# Multi-tenant, local-first architecture

## Product requirements

- Users sign in with Google, GitHub, or Facebook.
- Each user can create and manage many houses.
- Each user has common financial documents, such as preapprovals, bank statements, income documents, and lender quotes.
- Each house has house-specific documents, such as seller disclosures, inspections, permits, title reports, comparable sales, and offer documents.
- A user's data must never be visible to another user.
- The same application must be deployable in the cloud or entirely on infrastructure controlled by the operator.

## Core data model

```text
User 1 --- * AuthAccount
User 1 --- 1 BuyerProfile
User 1 --- * House
User 1 --- * Document
House 1 --- * DocumentLink
House 1 --- * Analysis
House 1 --- * OfferScenario
User 1 --- * SavedSearch
```

### Main tables

- `users`: application identity.
- `auth_accounts`: Google, GitHub, Facebook, local-login, or enterprise identity linked to a user.
- `buyer_profiles`: income, debts, liquid assets, reserve rules, and affordability preferences.
- `houses`: one row per candidate property, always owned by one user.
- `documents`: metadata for uploaded files, always owned by one user.
- `document_links`: optionally associates a document with one or more houses.
- `analyses`: extracted facts, risk findings, affordability results, and model provenance.
- `offer_scenarios`: purchase price, down payment, rates, contingencies, and cash-to-close scenarios.
- `saved_searches`: filters, provider settings, and notification preferences.
- `audit_events`: security-relevant access and mutation events.

## Document scopes

A document has one of two scopes:

1. `USER_COMMON`
   - Preapproval letters
   - Bank and brokerage statements
   - Pay statements and W-2s
   - Lender rate sheets
   - Buyer profile documents

2. `HOUSE_SPECIFIC`
   - Seller disclosures
   - Property inspections
   - Pest reports
   - Permit records
   - Preliminary title reports
   - Comparable sales
   - Offer and counteroffer documents

Common documents are not duplicated for each house. They remain owned by the user and may be referenced during any analysis for that user's houses.

## Tenant isolation

Every tenant-owned table includes an immutable `owner_user_id`.

Required controls:

- PostgreSQL Row-Level Security on every tenant-owned table.
- Default-deny database policies.
- Server-side authorization on every API call.
- Storage keys prefixed by the owner and scope.
- Signed, short-lived download URLs rather than public file URLs.
- Background jobs receive and verify both `owner_user_id` and object ID.
- No cross-user search, analytics, logs, cache keys, or model context.
- Automated tests attempt cross-user reads, updates, deletes, and file access.

Example storage layout:

```text
users/{userId}/common/{documentId}/original.pdf
users/{userId}/houses/{houseId}/{documentId}/original.pdf
users/{userId}/houses/{houseId}/{analysisId}/result.json
```

## Implemented: Google Drive per-user object storage

As a first `ObjectStorageProvider`, sensitive documents are stored directly in each user's own Google
Drive instead of a shared bucket:

```text
homebuyer-agent/
  common/                 <- USER_COMMON documents
  <house address>/        <- HOUSE_SPECIFIC documents for that house
```

Key decisions:

- The OAuth scope is `https://www.googleapis.com/auth/drive.file`, not the broader `drive` scope. This
  restricts the app to files/folders it creates itself and avoids Google's costly "restricted scope"
  security assessment required for the broader scope.
- Tenant isolation for documents is delegated to Google's own per-user OAuth access control instead of a
  database RLS policy: a user's access token can only ever see folders inside their own Drive, so there is
  no shared table or bucket key prefix to get wrong.
- Folder lookups always happen server-side by `(scope, address)`; API routes never trust a client-supplied
  Drive folder ID, which rules out a class of cross-folder/IDOR-style mistakes.
- Viewing and downloading a document is delegated to Google Drive's own `webViewLink`, so file bytes only
  ever pass through this app's server during upload.

## Authentication strategy

Use an authentication adapter instead of coupling business logic to one provider.

### Hosted mode

- Auth.js with Google, GitHub, and Facebook OAuth providers.
- Provider accounts are linked to one internal `user.id`.
- Optional email verification and passkeys can be added later.
- **Current implementation**: only the Google provider is enabled, because per-user Google Drive document
  storage (above) is tied to a Google session and its OAuth access token. GitHub and Facebook remain
  documented options for a future non-Drive storage adapter.

### Self-hosted mode

- Keycloak as the OpenID Connect provider.
- Keycloak can broker Google, GitHub, and Facebook identities.
- Add local username/password or passkey authentication for installations that must work without external social-login providers.

Important: social login can be used with a locally hosted application, but Google/GitHub/Facebook authentication still requires internet access to those providers. A fully offline deployment needs a local authentication method.

## Portable infrastructure adapters

Business logic must depend on interfaces, not cloud-specific SDKs.

```text
AuthProvider
DatabaseProvider
ObjectStorageProvider
LLMProvider
ListingProvider
NotificationProvider
```

### Cloud deployment

- Next.js application
- PostgreSQL or Cloud SQL
- Google Cloud Storage or S3
- Vertex AI Gemini
- Authorized listing APIs or MCP servers

### Local deployment

- Docker Compose
- Next.js application
- PostgreSQL
- MinIO or another S3-compatible object store
- Keycloak
- Ollama, vLLM, or another local model server
- Optional local MCP servers

The application should use the same database schema and storage API in both modes.

## Suggested repository layout

```text
apps/
  web/
  worker/
packages/
  core/
  auth/
  database/
  storage/
  llm/
  listings/
  security/
infra/
  docker-compose/
  cloud-run/
  migrations/
```

## Security rules

- Never commit real financial or property documents.
- Never place uploaded files in a public web directory.
- Encrypt transport with TLS.
- Encrypt stored files and database volumes.
- Redact account numbers and sensitive identifiers from logs.
- Apply file-type validation, file-size limits, and malware scanning.
- Allow users to export and permanently delete their own data.
- Record model name, prompt version, source documents, and timestamp for every analysis.

## Delivery phases

### Phase 1

- Multi-provider login
- User profile
- Multiple houses per user
- Common and house-specific document upload
- PostgreSQL schema with Row-Level Security
- Local filesystem storage adapter for development

### Phase 2

- S3/Google Cloud Storage adapter
- Disclosure and preapproval extraction
- Per-house affordability and risk analysis
- Saved searches and listing-provider adapters

### Phase 3

- Docker Compose deployment with PostgreSQL, MinIO, and Keycloak
- Local LLM adapter
- Export/import and backup tooling
- Security and tenant-isolation test suite

### Phase 4

- Alerts, collaboration by explicit invitation, offer workflow, and lender comparison

## Acceptance criteria

- A user can sign in with Google, GitHub, or Facebook and receives one internal account.
- A user can create multiple houses and view them independently.
- Common documents are available only to analyses for houses owned by the same user.
- House-specific documents cannot be attached to or read from another user's house.
- Cross-user database and storage access tests fail closed.
- The application runs using both cloud adapters and a fully self-hosted Docker Compose profile.
