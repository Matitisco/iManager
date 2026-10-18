# Product analytics — #394, PR 1

Collection and admin JSON only. The existing activity panel checks permission before fetching data; its layout and content stay unchanged. The only text addition is the internal-metrics sentence in the landing privacy paragraph.

## Access contract

`ADMIN_EMAILS` is a comma-separated allowlist. The Firebase token must contain a verified email (`email_verified === true`); comparisons trim whitespace and ignore case. Store ownership, billing plan and membership do not grant platform-admin access.

All four endpoints require authentication and send `Cache-Control: no-store`:

- `GET /api/me/admin`: verified admin → `200 { isAdmin: true }`.
- `GET /admin/store-activity?range=30d|all`: existing response plus `stuckAt` and `activeDays30` on each store.
- `GET /admin/funnel?range=7d|30d|all&tests=hide|show`: cohort milestones, stock methods, retention and median hours. Defaults to `30d` and `hide`.
- `GET /admin/stores/:id/timeline`: chronological events and historical milestones, capped at 500, masked owner email. Missing store → 404 for an authorized admin.

No/invalid token → 401. Authenticated non-admin or unverified email → `403 { error: "Forbidden" }`. The frontend capability service maps 403/404 to `{ isAdmin: false }`; the page shows its existing “No encontramos esta página” state and never requests store activity when the capability is false. There are no navigation links to the panel.

## Collection

Only the new `ProductEvent` table and virtual `Store.productEvents` relation are added. The migration is idempotent and agrees with Prisma's generated schema; `pre-push.sql` stays unchanged. No existing column or uniqueness rule changes.

Server tracking runs after successful commits, without awaiting it on critical request paths. Props are event-specific enums, booleans and finite nonnegative numbers. Writes use `createMany` with `skipDuplicates`; errors log a fixed warning without payloads. `ANALYTICS_DISABLED=1` disables writes.

`POST /api/events` uses authenticated internal IDs, including a null store before onboarding. Body identity fields are ignored; other unknown envelope/event fields fail strict validation. Only client event names are accepted, with 1–20 events per batch and a 16 KB body limit. View dedupe keys are server-owned. An in-memory limit silently drops events above 60/min/user with 204. Billing read-only mode allows ingestion.

Active days use the Argentina calendar date and a bounded process cache. Store retention counts distinct Argentina dates across users. `x-im-device` accepts only phone/desktop and the optional `pwa=1` flag; no user agent, IP, emails, names, amounts or free text enter event props. Auth session requests also carry the coarse device header.

First-step flags are observed in `getGettingStarted`, with stable per-store/step keys. The initial store step is emitted after onboarding commit. Exact sale events cover the legacy sale service, sales import, integrated operations and trade confirmation. Existing stores use domain-table milestones; installation flags without a timestamp count toward the funnel without inventing an installation date in the timeline.

The browser batches at 10 events or 3 seconds and flushes on hidden/pagehide using authenticated keepalive fetch, with one retry. It discards queues on identity changes and is disabled in Vitest unless explicitly enabled.

## Verification

Use only the local `imanager_test` PostgreSQL database for schema push and integration/E2E tests. Run root/backend lint, frontend Vitest, backend unit/integration suites, root/backend TypeScript and builds. `e2e/analytics.spec.ts` checks name → stock → skip at 390 and 1440 px; the existing onboarding and mobile-dashboard specs cover behavior regressions.

Validated locally: 923 frontend tests, 457 backend unit tests, 282 integration tests, root/backend lint and explicit TypeScript, root/backend builds. Chromium passed 29 distinct scenarios across desktop onboarding, phone onboarding, dashboard and analytics sequence checks. The phone onboarding wrapper was temporary; the existing WebKit spec could not launch due to missing host libraries. The new migration executed twice locally and `prisma migrate diff` reported no difference.
