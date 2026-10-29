## Decisions
El detalle abre `edit-eq` y `del` de equipo mediante `useDesk().open`, reemplazando la hoja activa. Archivar conserva el permiso `canManageSensitive`, la exclusión de archivados y ReasonSheet. Vender pasa al ContextMenu con la misma condición `isInStock`. El pie reutiliza botones btn2 secundarios y primario, tres columnas en escritorio y dos secundarios sobre el primario en móvil, con CSS limitado a eq-sheet.

## Validation
Tests unitarios con DeskOverlays real para navegación, confirmación, errores, permisos, guardado y estado ocupado en desktop/mobile. TypeScript frontend/backend y CI del PR, sin build local ni watchers.
