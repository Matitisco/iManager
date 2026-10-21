# Auditoría de dependencias — 2026-10-21

Repositorio verificado: `https://github.com/Matitisco/iManager.git`. `git ls-remote origin refs/heads/main` confirmó `7f4b7ce480723008da635e983e77541d6bb3214b`, igual al checkout inicial limpio. Rama de corrección: `fix/dependency-security-audit`.

Se revisaron los tres manifiestos/locks: raíz, backend y landing. Los conteos son paquetes afectados según npm audit, incluidos padres afectados transitivamente; no son CVE únicos y no deben sumarse entre paquetes del repositorio como si fueran únicos.

| Paquete | Antes, completo | Después, completo | Antes, omit=dev | Después, omit=dev |
|---|---:|---:|---:|---:|
| Raíz | 53 (1 crítica, 36 altas, 11 moderadas, 5 bajas) | 0 | 43 | 0 |
| Backend | 50 (1 crítica, 32 altas, 13 moderadas, 4 bajas) | 3 altas | 40 | 3 altas |
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

## Excepción pendiente: Prisma / deepmerge-ts

**Estado: sin corrección compatible validada para Prisma 6. No resuelta ni suprimida.**

| Paquete afectado | Versión | Relación | Severidad |
|---|---|---|---|
| deepmerge-ts | 7.1.5 | transitiva, causa raíz | Alta |
| @prisma/config | 6.19.3 | transitiva | Alta heredada |
| prisma | 6.19.3 | directa, declarada en devDependencies | Alta heredada |

[GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) afecta al merge de grafos recursivos y puede agotar la pila. Está corregido a partir de deepmerge-ts 8.0.0. `@prisma/config@6.19.3` fija **7.1.5**, por lo que actualizar dentro de rangos compatibles no lo elimina. Aunque npm audit final informa `fixAvailable: true`, `npm audit fix --dry-run --ignore-scripts --json` propone **0 cambios** y conserva las 3 alertas; se adjunta ese diagnóstico.

**Alcance real:** aunque Prisma esté declarado como desarrollo, npm incluye esta cadena en `--omit=dev` por el árbol peer de @prisma/client; además `npm start` ejecuta `prisma db execute` y `prisma db push` en producción. No debe etiquetarse como un problema exclusivamente de tests. La llamada observada en `@prisma/config/dist/index.js` carga deepmerge para combinar configuración mediante c12. No se encontró exposición directa de este merge a cuerpos HTTP, y no existe prisma.config en el repositorio; esto limita la superficie observada, pero no prueba ausencia de riesgo.

**Alternativas y bloqueo:** (1) backport/actualización oficial de Prisma 6 que acepte deepmerge-ts corregido; (2) migración separada de Prisma/client a una línea corregida, con revisión de configuración, generación, adaptadores y arranque; (3) override de deepmerge-ts 8, fuera del pin exacto del proveedor, con pruebas específicas de resolución/merge de configuración, ciclos y compatibilidad. Ninguna se aplicó a ciegas para obtener un cero artificial. Mantener configuración de Prisma bajo control de versiones y no cargar configuración de fuentes no confiables mientras se resuelve.

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
- Backend unitario: **75 archivos, 510 pruebas aprobadas**.
- Backend integración: **39 archivos, 322 pruebas aprobadas** sobre base local aislada.
- PWA assets/worker/servidor: **15 pruebas aprobadas**.
- Smoke de overrides: `uuid.v4()` válido, CommonJS, desde cada uno de los cuatro consumidores; ExcelJS escribe y vuelve a leer XLSX con iconSet extendido (`3Stars`, ruta que genera UUID): aprobado.
- Chromium, importación XLSX desktop/mobile y escáner Android: **8/9 aprobadas en conjunto**. El escenario `venta sin stock vuelve cargada y el canje toma el equipo` falló al esperar el modelo tras lectura por teclado; **pasó aislado sin retries (1/1)**. Se conserva este resultado como intermitencia; no se afirma que el primer pase completo haya sido verde.
- El primer pase PWA encontró dos selectores desktop obsoletos (`Equipos` cuando el menú actual abre `Stock`). Se ajustó exclusivamente la navegación de esas pruebas, manteniendo las verificaciones de foco y actualización del service worker.
- WebKit/iPhone **no validado**: faltan `libgtk-4.so.1`, `libgraphene-1.0.so.0`, `libharfbuzz-icu.so.0`, `libmanette-0.2.so.0`, `libhyphen.so.0`, `libwoff2dec.so.1.0.2` y `libGLESv2.so.2` en el entorno. No hubo rechazo de autorización: es una limitación de bibliotecas disponibles. No se afirma ejecución de la suite E2E completa.
- Advertencias existentes: `@zxing/library@0.23.0` declara Node >=24, aunque repo/CI usa 22; versión y requisito ya estaban en la base. Los builds de frontend emiten advertencia de chunks grandes; algunos tests de imágenes avisaron de caché Fontconfig no escribible, sin fallar. No se cambió motor ni infraestructura para ocultar estas advertencias.

No se usó Railway, `npm start`, facturación live, SMTP live, Firebase live ni datos/credenciales de producción. No hubo merge ni push a main. Los reportes adjuntos preservan las tres alertas pendientes, también en producción.

PWA Chromium desktop/Android: primer pase **35 aprobadas, 25 omitidas por plataforma y 2 fallidas por selectores obsoletos**. Tras la corrección, **4/4 casos afectados (ambas plataformas) aprobados**; en total 37 escenarios distintos validados. No se repitieron las 35 pruebas sin cambios.

Nota de conteo: un reporte intermedio incluyó @prisma/client como cuarto padre afectado. La auditoría final con caché npm escribible y metadatos completos enumera 3 paquetes, tanto completa como con omit=dev; la causa raíz y el alcance de ejecución de Prisma no cambiaron.
