# Proposal

## Why
La invitación de instalación puede duplicarse, aparecer fuera de Dashboard y conservar accesos después de un descarte ambiguo. Issue #466 define una invitación móvil única y dos descartes con significado distinto.

## What Changes
- Banner blanco únicamente en Dashboard después de 30 segundos elegibles, retirado inmediatamente al navegar, ocultar la pestaña o abrir un formulario/modal.
- Ahora no aplaza siete días; No volver a mostrar conserva acceso únicamente desde Ayuda.
- Guía manual por plataforma, soporte de prompt tardío, migración de descartes y sincronización entre pestañas.
- Evidencia PNG y pruebas con API simulada a 390 px y 1440 px.

## Capabilities
### New Capabilities
- `pwa`: los requisitos de instalación existen en cambios activos sin archivar; este delta sustituye los requisitos correspondientes de `install-help` y `add-installable-pwa` sin modificar sus artefactos.
### Modified Capabilities
Ninguna capability PWA está promovida en `openspec/specs/`.

## Impact
Frontend: utilidades PWA, InstallApp, InstallHelp, Ayuda y acceso desde Primeros pasos. Sin cambios en API, AppContext, backend ni schema Prisma.

## Non-goals
Navegación/Más de #450, rediseño de Dashboard, service worker, despliegue, commit/push e instalación física de dispositivos.
