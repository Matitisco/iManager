- [x] Capture main at desktop/iPhone sizes and generate a reference mockup outside the repository.
- [x] Replace visible loading copy with shared placeholders while preserving content and errors.
- [x] Add source guard and component coverage; run tests and typechecks (1,354 frontend tests; both TypeScript checks).
- [x] Push `fix/483-d-sin-cargando`, verify locally, capture final screens and open PR #493 with `pendiente de revisión` and `Refs #483`.

Validation: 1,354 frontend tests passed; 64 relevant tests repeated after visual review. Frontend/backend TypeScript checks and diff check passed. The source guard detects 29 baseline loading literals and zero current visible cases. Eight local desktop/iPhone transitions passed with pending requests, no visible loading copy, no JavaScript errors or horizontal overflow. Sixteen reference and sixteen final PNGs at 1440/390 px plus the generated mockup remain outside the repository in `/workspace/imanager-local/shots/483-d/`. No build, backend/schema changes or production actions.
