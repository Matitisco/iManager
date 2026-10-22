# Tasks

## 1. Frontend: preferencias
- [x] 1.1 Implementar preferencia v2, migración, memoria y sincronización/vencimiento; verificar con pwa.test.ts.
- [x] 1.2 Separar resultados del prompt y evitar doble consumo; verificar aceptación, cierre y fallo.

## 2. Frontend: invitación y accesos
- [x] 2.1 Implementar elegibilidad, observador, banner y confirmaciones; verificar InstallApp e install-visibility.
- [x] 2.2 Restringir tarjeta y Primeros pasos, conservar Ayuda y subtítulo; verificar InstallHelp, HelpScreen y getting-started.

## 3. Evidencia e integración
- [x] 3.1 Añadir Playwright aislado con API simulada y PNG 390/1440; verificar layout, estados y documentar comandos/límites.
- [x] 3.2 Ejecutar suites completas frontend/backend, typechecks, pruebas PWA y diff check; registrar resultados en docs/issue-466/README.md y PROJECT_STATUS.md.

## Backend
Sin cambios de backend, AppContext ni Prisma. Integraciones exclusivamente con PostgreSQL local imanager_test.
