## Why

Issue #290 requires installing iManager on phones, primarily iPhone, with the proposal 3 brand and working Firebase authentication.

## What Changes

- Complete the manifest, Apple metadata, icons and launch images.
- Cache only the versioned static application shell in production.
- Offer a delayed, dismissible Safari guide and Android native install action after store/session resolution.
- Respect standalone safe areas and use same-origin Firebase redirect helpers for iOS standalone Google login.

## Capabilities

### New Capabilities
- `pwa`: mobile installation, static caching, standalone layout and authentication.

### Modified Capabilities
None.

## Impact

Frontend App/DeskApp, authentication adapter, Vite build and Node static server. No backend business changes, AppContext edits or Prisma schema changes. Production Google redirect requires the deployed origin/handler authorized in Firebase/Google OAuth.

## Non-goals

Offline business writes, caching business data or sessions, push notifications, native app stores and desktop install banners.
