## ADDED Requirements

### Requirement: Frontend runtime configuration comes from Vite environment variables
The frontend SHALL resolve its backend base URL and Firebase web configuration from `VITE_*` environment variables instead of a versioned runtime JSON file.

#### Scenario: Local development bootstraps from `.env.local`
- **WHEN** a developer starts the frontend with a valid `.env.local`
- **THEN** the app uses `VITE_API_BASE_URL` and the `VITE_FIREBASE_*` values from that file to initialize backend access and Firebase Auth

#### Scenario: Required Firebase web variables are missing
- **WHEN** the frontend starts without one or more required `VITE_FIREBASE_*` variables
- **THEN** it fails fast with an explicit error that identifies the missing keys instead of silently using a stale runtime config

### Requirement: Backend environment contracts differ by environment source, not by code path
The backend SHALL support development configuration from `backend/.env` and production configuration from deployment-provided variables while enforcing the same required contract for `DATABASE_URL`, `FRONTEND_URL`, Firebase Admin credentials, and optional environment-specific CORS origins.

#### Scenario: Local development loads `backend/.env`
- **WHEN** the backend starts in development and `backend/.env` exists
- **THEN** it loads local values for `DATABASE_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and Firebase Admin credentials before parsing the environment contract

#### Scenario: Production uses deployment variables
- **WHEN** the backend starts in production on the deployment platform
- **THEN** it reads `DATABASE_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and Firebase Admin credentials from the deployment environment without requiring committed secrets

### Requirement: Invitation URLs are environment-specific
The backend SHALL generate invitation URLs from the validated `FRONTEND_URL` of the active environment so development and production links never point to the wrong frontend host.

#### Scenario: Invitation created in production
- **WHEN** an owner creates an invitation while the backend is running with the production `FRONTEND_URL`
- **THEN** the response includes an `inviteUrl` pointing to the production frontend host

#### Scenario: Invitation created in development
- **WHEN** an owner creates an invitation while the backend is running with a development `FRONTEND_URL`
- **THEN** the response includes an `inviteUrl` pointing to the development frontend host
