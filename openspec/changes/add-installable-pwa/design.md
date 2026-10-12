## Context

The app has an incomplete manifest, Firebase popup login, and a Node SPA server. Mobile views already use several safe-area insets. This session is authorized to implement/build/test and commit on the existing branch without push or PR. The OpenSpec CLI is absent in the environment; the four artifacts are created directly before implementation.

## Decisions

- Generate checked-in PNG icons and portrait/landscape iPhone launch images from the provided proposal 3 512px PNG using a reproducible Pillow script; no added application/runtime dependencies. Chromium rasterization was unavailable because this environment blocks browser startup.
- Generate a service worker with a build-specific cache and explicit precache list from Vite output. Precache HTML and bundled assets; runtime caching is restricted to known public branding assets. API, cross-origin, Authorization-bearing, query-string and Firebase helper requests bypass it. Offline HTML only reopens the shell; backend/session failures stay visible. Updates wait for existing clients to close, preventing unsaved work from being reloaded.
- Capture beforeinstallprompt at bootstrap before React/session loading. Show mobile-only invitation after 30 seconds in an eligible signed-in store session, while visible and outside operations/invitation overlays. Persist dismissal in localStorage, with an in-memory fallback for unavailable storage. Hide on appinstalled and both display-mode/iOS standalone detection.
- Illustrate Safari's Share and Add to Home Screen controls inline. Do not offer unsupported browsers an unusable native install button.
- Use Firebase signInWithRedirect for iOS standalone; retain popup elsewhere and email/password everywhere. Resolve returning redirect results once and surface errors on Login. For iOS standalone, configure Firebase authDomain to the app host and proxy /__/auth/ and /__/firebase/init.json through the web server, never via the service worker. Document OAuth handler allowlisting as deployment configuration.
- Extend safe areas at the document/shell level, avoiding double top/bottom insets already applied to headers and docks.

## Validation

Unit tests cover prompt timing/dismissal/installation/browser variants, auth selection and redirect errors, worker cache exclusions/lifecycle, and server proxy/headers. Production browser tests use Chromium and WebKit with iPhone emulation, including real service-worker offline shell/API behavior. Real iPhone Home Screen installation and real Google OAuth cannot be proven by desktop WebKit; record this limitation and an explicit manual device checklist.

## Environment limitations observed

- Chromium startup fails with `sandbox_host_linux.cc` / `Operation not permitted`.
- WebKit is absent; installing in `/tmp` fails DNS resolution for the Playwright download hosts.
- Production PWA E2E server fails `listen EPERM` on `127.0.0.1:4190`. The suite is checked in and wired into CI but was not executed successfully here.
- `.git` is read-only: `git add -A` fails creating `.git/index.lock`. Local commit remains blocked; no push or PR was attempted.
