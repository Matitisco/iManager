# Auditoría de dependencias — 2026-10-21

Repositorio verificado: `https://github.com/Matitisco/iManager.git`. `git ls-remote origin refs/heads/main` confirmó `7f4b7ce480723008da635e983e77541d6bb3214b`, igual al checkout inicial limpio. Rama de corrección: `fix/dependency-security-audit`.

Se revisaron los tres manifiestos/locks: raíz, backend y landing. Los conteos son paquetes afectados según npm audit, incluidos padres afectados transitivamente; no son CVE únicos y no deben sumarse entre paquetes del repositorio como si fueran únicos.

| Paquete | Antes, completo | Después, completo | Antes, omit=dev | Después, omit=dev |
|---|---:|---:|---:|---:|
| Raíz | 53 (1 crítica, 36 altas, 11 moderadas, 5 bajas) | 0 | 43 | 0 |
| Backend | 50 (1 crítica, 32 altas, 13 moderadas, 4 bajas) | 0 | 40 | 0 |
| Landing | 0 | 0 | 0 | 0 |

Los 32 hallazgos del despliegue anterior no representan el estado actual de la base de avisos. Los reportes JSON y [el inventario completo](inventory.md) conservan severidades, versiones iniciales, condición directa/transitiva, clasificación producción/desarrollo y enlaces a los avisos.

## Cambios

- API: Fastify 5.8.5 → 5.12.7, Firebase Admin 13.7.0 → 13.10.0; actualizaciones compatibles de transitivas en el lock.
- Raíz: Vite 6.4.2 → 6.4.4 y transitivas corregidas de Babel, CSS, ExcelJS, Firebase y herramientas de prueba.
- Ambos: Vitest/coverage 4.1.4 → 4.1.12, tsx 4.21.0 → 4.23.15; mínimos declarados de las herramientas actualizados.
- Override protobufjs 7.5.5 → 7.6.6 en ambos; se elimina la fijación a una versión con múltiples avisos de seguridad.
- Override limitado a `@firebase/firestore → @grpc/grpc-js ~1.13.7`: conserva la línea 1.13 y evita la versión vulnerable fijada por Firestore.
- Overrides de uuid 11.1.1 limitados a ExcelJS (raíz), gaxios, google-gax y teeny-request (backend). Es un salto mayor transitivo deliberado: se inspeccionó que todos consumen únicamente `v4()` sin buffer; uuid 11 conserva CommonJS y esa API. Smoke de cada consumidor y round-trip XLSX con formato condicional extendido aprobados. No se impone uuid 12+, que elimina CommonJS. Retirar overrides cuando los padres incorporen versiones corregidas.
- La crítica transitiva websocket-driver se corrige dentro de su línea compatible; no cambia la lógica de negocio ni el schema Prisma.
- Landing no requiere cambios.

Se utilizó `npm audit fix --package-lock-only --ignore-scripts` sin `--force`, seguido de selección explícita de herramientas y overrides revisados. No se aceptaron las propuestas de degradar Firebase/ExcelJS ni de migrar Firebase Admin de major automáticamente.

## Excepción de Prisma resuelta tras validación adicional

El diagnóstico inicial dejó 3 alertas de `deepmerge-ts@7.1.5 → @prisma/config@6.19.3 → prisma@6.19.3`. Se validó ahora un override limitado a `@prisma/config@6.19.3 → deepmerge-ts@8.0.2`, manteniendo Prisma/client 6.19.3. La auditoría final completa y de producción es **0**.

La reproducción del advisory falla con 7.1.5 y pasa con 8.0.2; se validaron carga real de configuración, generación de cliente, TypeScript/build y pruebas backend. Compatibilidad acotada, diferencias de Map, riesgos comprobados/potenciales y alcance están en [el diagnóstico específico](deepmerge-prisma6.md). Los JSON `backend-before-deepmerge-override` y `backend-prod-before-deepmerge-override` conservan las 3 alertas intermedias.

## Reproducción segura

Usar Node 22 (validación realizada con 22.23.3) y npm 11.9.0. Caché npm en directorio escribible. No se cargaron archivos .env ni credenciales/datos de producción.

```sh
npm ci
npm --prefix backend ci
npm --prefix landing ci
npm audit --json
npm audit --omit=dev --json
npm --prefix backend audit --json
npm --prefix backend audit --omit=dev --json
npm --prefix landing audit --json
npm run lint
npm --prefix backend run lint
npm --prefix landing run lint
npm run build
npm --prefix backend run build
npm --prefix landing run build
npm run test:frontend -- --maxWorkers=2
npm --prefix backend run test:unit -- --maxWorkers=2
npm run test:pwa
```

Integración usa exclusivamente PostgreSQL 16 en un contenedor nuevo, puerto local 55432 y base `imanager_security_test`. E2E usa otra base `imanager_security_e2e` del mismo contenedor. Exportar explícitamente `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/<base_de_prueba>` antes de `prisma db push --skip-generate` y de las pruebas. No ejecutar `npm start` para validar: incluye tareas de sincronización ajenas al alcance.

Configurar `PLAYWRIGHT_BROWSERS_PATH` al directorio donde se instalaron los navegadores. La suite frontend contiene tests que lanzan Chromium real.


## Validación y límites

- `npm ci` en raíz, backend y landing: aprobado. Tras los overrides se resolvió el árbol instalado con npm; `npm ls --all` sin dependencias inválidas. Raíz y backend también reinstalados desde los locks finales.
- `npm run lint` y `npm run build` en los tres paquetes: aprobados (Prisma Client 6.19.3 generado localmente, sin migrar producción).
- Frontend: **153 archivos, 1077 pruebas aprobadas**. Primer pase: 1070 aprobadas y 7 omitidas por Chromium no localizado; se instaló/configuró su ruta y el pase completo final quedó verde.
- Backend unitario: **76 archivos, 516 pruebas aprobadas** tras el override deepmerge-ts (incluye 6 regresiones nuevas).
- Backend integración: **39 archivos, 322 pruebas aprobadas** sobre base local aislada.
- PWA assets/worker/servidor: **15 pruebas aprobadas**.
- Smoke de overrides: `uuid.v4()` válido, CommonJS, desde cada uno de los cuatro consumidores; ExcelJS escribe y vuelve a leer XLSX con iconSet extendido (`3Stars`, ruta que genera UUID): aprobado.
- Chromium, importación XLSX desktop/mobile y escáner Android: **8/9 aprobadas en conjunto**. El escenario `venta sin stock vuelve cargada y el canje toma el equipo` falló al esperar el modelo tras lectura por teclado; **pasó aislado sin retries (1/1)**. Se conserva este resultado como intermitencia; no se afirma que el primer pase completo haya sido verde.
- El primer pase PWA encontró dos selectores desktop obsoletos (`Equipos` cuando el menú actual abre `Stock`). Se ajustó exclusivamente la navegación de esas pruebas, manteniendo las verificaciones de foco y actualización del service worker.
- WebKit/iPhone **no validado localmente** (sí aprobado en CI remoto, ver actualización abajo): faltan `libgtk-4.so.1`, `libgraphene-1.0.so.0`, `libharfbuzz-icu.so.0`, `libmanette-0.2.so.0`, `libhyphen.so.0`, `libwoff2dec.so.1.0.2` y `libGLESv2.so.2` en el entorno. No hubo rechazo de autorización: es una limitación de bibliotecas disponibles. No se afirma ejecución de la suite E2E completa.
- Advertencias existentes: `@zxing/library@0.23.0` declara Node >=24, aunque repo/CI usa 22; versión y requisito ya estaban en la base. Los builds de frontend emiten advertencia de chunks grandes; algunos tests de imágenes avisaron de caché Fontconfig no escribible, sin fallar. No se cambió motor ni infraestructura para ocultar estas advertencias.

No se usó Railway, `npm start`, facturación live, SMTP live, Firebase live ni datos/credenciales de producción. No hubo merge ni push a main. Los reportes finales ya no contienen alertas; los intermedios preservan el diagnóstico previo.

PWA Chromium desktop/Android: primer pase **35 aprobadas, 25 omitidas por plataforma y 2 fallidas por selectores obsoletos**. Tras la corrección, **4/4 casos afectados (ambas plataformas) aprobados**; en total 37 escenarios distintos validados. No se repitieron las 35 pruebas sin cambios.

Nota de conteo: un reporte intermedio incluyó @prisma/client como cuarto padre afectado. La auditoría previa al override con caché npm escribible y metadatos completos enumeró 3 paquetes, tanto completa como con omit=dev; la causa raíz y el alcance de ejecución de Prisma no cambiaron.


## Seguimiento de CI y selectores preexistentes

La revisión `00158bf` terminó con CI rojo, sin bloqueo del runner: [PR run 39540839681](https://github.com/Matitisco/iManager/actions/runs/39540839681), E2E 30,8 minutos, 274 passed / 2 flaky recuperados / 7 skipped / 5 failed; [push run 39540834855](https://github.com/Matitisco/iManager/actions/runs/39540834855), 29,1 minutos, 273 passed / 3 flaky / 7 skipped / 5 failed. En ambos aprobaron todas las etapas anteriores: 1077 frontend, 15 PWA assets, 57 PWA navegadores (36 omitidos por plataforma), 516 unitarias y 322 integraciones backend. WebKit/iPhone sí pudo validarse en los runners remotos.

Los cinco fallos idénticos esperaban `sidebar-tab-service` (mobile-service), `sidebar-tab-tradeins` (dos casos mobile-trade-ins), `sidebar-tab-history` (natan1-shots) y `1 en Equipos` desktop (section-notices). El cambio previo [4e0a087](https://github.com/Matitisco/iManager/commit/4e0a08782a83216facfddf35156fda0ebc05891b), ya en main, movió las subsecciones a tabs de grupo y agregó el helper `openDeskSection`, pero omitió estos casos. El código de aplicación y esos tests eran idénticos a main antes de esta corrección. El run de la base exacta 7f4b7ce falló antes de E2E en PWA: no se afirma reproducción completa E2E sobre la base.

Con autorización posterior se adaptan solo los selectores desktop: helper existente para servicio/canjes/historial/inventario y badge del grupo Stock. Se conservan aserciones de tablero/lista, filtros/totales, historial/permisos/anulación y contador/resaltado. Ningún skip, retry ni timeout agregado.

El primer pase local posterior a los selectores dio 3 aprobados y 3 fallidos: el import histórico retornaba errores al faltar cotización externa y los dos casos de novedades no podían guardar por el mismo proveedor externo. Se fijan únicamente fixtures de esos tests: cotización explícita en el import (campo admitido por API) y respuesta de `/api/commissions/exchange-rate` en las pruebas de novedades. Ventas, stock, historial y novedades siguen usando la API real y PostgreSQL local; el import ahora exige una venta creada y cero errores, evitando una preparación silenciosamente incompleta.

Validación local de la corrección: **6/6 E2E aprobados, sin reintentos, en 25,9 s**, con Chromium y PostgreSQL local aislado. Lints frontend/backend aprobados. Se requiere CI completo de la nueva revisión para integrar; no se declara main actualizado.
