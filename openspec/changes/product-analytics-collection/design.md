# Design

Add only ProductEvent and a virtual Store relation. Best-effort, post-commit tracking uses sanitized enum/boolean/number props and database deduplication. Authenticate ingestion with session IDs, bounded batches and an in-memory rate limiter. Aggregate historical domain milestones and events for guarded admin JSON. Batch frontend events without changing markup or styles. Test exclusively against local imanager_test.

Admin access requires an email verified by Firebase and an ADMIN_EMAILS match (trimmed, case-insensitive). All admin data endpoints and /api/me/admin return 401 without valid auth and 403 Forbidden for other authenticated users. The frontend converts a denied capability probe to isAdmin=false and displays the existing not-found state before loading activity. No navigation links are added.
