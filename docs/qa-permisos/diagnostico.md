# Apertura de permisos de un miembro

## Causa y cambio

`DeskApp` usaba el ID de cada entrada de navegación como `key` del contenedor. Pasar de Equipo a permisos desmontaba `SettingsScreen`, descartaba los miembros disponibles y repetía `listMembers` y `listInvitations`. `Promise.all` además impedía mostrar miembros hasta recibir las invitaciones. Durante esa espera se veía nuevamente Equipo.

Configuración ahora conserva su montaje durante sus rutas internas, con una clave aislada por usuario, tienda, rol y secciones. Las entradas de historial siguen conservando su propio scroll. Salir de Configuración o cambiar el alcance desmonta el estado; no se agregó caché persistente ni se extendió su vigencia entre módulos. El editor usa el ID del miembro como clave para descartar borradores al cambiar de persona. Miembros e invitaciones resuelven independientemente, conservando el descarte de respuestas tardías; los enlaces directos pendientes usan `ListSkeleton` existente, diferido 180 ms, sin texto visible de carga. Se mantienen guardado, errores de persistencia y controles de acceso.

## Medición local

App Vite en `127.0.0.1:4440`, API en `127.0.0.1:3440` y Postgres falso `127.0.0.1:5433/imanager_permisos`. Datos exclusivamente ficticios: 26 miembros (propietario, encargados y empleados con distintos permisos), 24 clientes, 40 equipos, 6 reparaciones y 7 gastos. Sin consultas a servicios externos ni bases reales.

Playwright + Chrome DevTools Protocol; viewport 1440×900, cinco aperturas por condición, recursos calientes. Desde `pointerdown` hasta el primer `requestAnimationFrame` con los switches de permisos presentes. Ambas condiciones usan 200.000 B/s de descarga y 100.000 B/s de subida; latencia agregada de 0 o 150 ms. Son mediciones de desarrollo, no un benchmark de un bundle productivo.

| Condición | Antes, ms | Después, ms | Mediana antes → después |
| --- | --- | --- | --- |
| Latencia 0 ms | 189, 182, 180, 174, 181 | 70, 53, 55, 67, 83 | 181 → 67 ms |
| Latencia 150 ms | 333, 331, 320, 331, 331 | 64, 69, 52, 51, 52 | 331 → 52 ms (84% menos) |

Por apertura, en las diez muestras de cada versión:

- GET de negocio: **4 → 0**; miembros e invitaciones se repetían dos veces por StrictMode de desarrollo. No era una cascada entre esos endpoints: salían en paralelo, pero innecesariamente tras cada navegación.
- Transferencia GET de negocio, CDP `encodedDataLength` (incluye cabeceras): **19.078 → 0 bytes**. Cada respuesta de miembros ocupaba 9.219 bytes; invitaciones, 320 bytes. Payload pequeño: el defecto era volver a transferirlo.
- Commits del árbol React hasta contenido visible, hook DevTools: **3 → 2**. La primera confirmación del árbol posterior ya contiene `MemberPermissions`; antes aparecía después de resolver las lecturas. Los 12 switches no requieren virtualización ni memoización adicional. `Performance.getMetrics` no muestra una reducción consistente de CPU: la mejora medida viene de quitar la espera de red.
- No se descargó ningún chunk JavaScript al abrir permisos. No se agregó code splitting.

Waterfall representativo sin latencia: dos GET de invitaciones terminaban en 14/21 ms; los dos GET de miembros, en 126/133 ms (TTFB 30/36 ms). Con 150 ms agregados, miembros terminaba en 270/278 ms. Después no hay solicitudes de negocio al abrir ni al volver.

La consulta Prisma usada por `listMembers`, ejecutada con el mismo filtro, selección y orden sobre los 26 miembros falsos, emitió **2 consultas SQL**, con duraciones reportadas de 1/0 ms y 5,1 ms de tiempo total. No hay N+1 por miembro. No se modificaron backend, schema, índices ni dependencias.

## Validación

- `npm run lint` y `npm --prefix backend run lint`: aprobados, sin build.
- `npx vitest run src/desk/DeskApp.test.tsx src/desk/screens/AccountScreens.test.tsx src/desk/route-viewport.test.tsx src/desk/team-permissions.test.ts --maxWorkers=2`: **93 pruebas aprobadas** tras integrar los cambios concurrentes de navegación de main (89 en la primera pasada).
- Nuevas regresiones en el shell real a 390/1440: abrir/guardar/volver sin refetch, actualización del estado guardado, descarte del borrador al cambiar de miembro y aislamiento al cambiar de usuario.
- Enlaces directos con invitaciones pendientes o fallidas: el editor muestra los miembros disponibles.
- Playwright móvil con API/DB falsas: guardar, reabrir y recargar conserva permisos; se restituyó el valor inicial después de verificarlo. Enlace directo con invitaciones demoradas artificialmente 1.200 ms: contenido visible en **47 ms**, invitaciones todavía pendientes.
- Capturas de escritorio antes/después y móvil después revisadas; sin cambios de CSS, sin desborde horizontal móvil. Sin texto nuevo de carga ni flash de Equipo al abrir un miembro disponible.

Evidencia mínima en `/workspace/qa-permisos/`: `before.json`, `after.json`, `queries.json`, `verification.json`, scripts `measure.mjs`/`verify.mjs`, `before-1440.png`, `after-1440.png`, `after-390.png` y logs de las comprobaciones. Los scripts y semillas de ese directorio son herramientas locales y sus datos son de ejemplo.
