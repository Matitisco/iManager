# Selección de tests en PR

`changes` calcula el diff completo desde merge-base hasta el head del PR, con nombres delimitados por NUL. El plan se pasa como JSON por variables de entorno y los archivos se entregan a Vitest como argumentos, sin shell.

| Cambio | Frontend | Backend | E2E/PWA |
| --- | --- | --- | --- |
| Fuentes UI, estilos, rutas | related + regresiones de filesystem relacionadas | omitido | smoke |
| Fuentes backend | related (dependientes frontend + guardia UTF-8) | related unit/integración + tests del módulo tocado | omitido |
| Tests frontend solamente | related | omitido | omitido |
| E2E, public, manifest, worker, scripts PWA/servidor SPA | related + lectores de fixtures relacionados | omitido | smoke |
| Config global, lockfile/dependencias raíz, infraestructura CI desconocida | completo (2 shards) | completo | smoke |
| Prisma/config/setup/dependencias backend | completo | completo | omitido salvo otros cambios UI |
| Fuentes borradas o renombradas | completo del proyecto afectado y dependientes | completo si afecta backend | según las rutas modificadas |
| Docs solamente | omitido | omitido | omitido |
| Push main, nightly, dispatch | completo (2 shards) | completo | 8 shards E2E + 3 proyectos PWA |

Lint/TypeScript de ambos proyectos corre siempre, incluso docs. El agregador requerido sigue siendo `test`: acepta trabajos omitidos y falla si detección o cualquier trabajo seleccionado falla/se cancela.

Vitest sigue dependencias transitivas: cambiar código backend importado por `app` puede seleccionar numerosas integraciones HTTP. Es deliberado para conservar cobertura. Los tests del módulo tocado también se incluyen aunque usen mocks. Las pruebas frontend que leen fuentes/CSS se seleccionan por referencias de archivo o raíces recorridas; no dependen exclusivamente del grafo de imports. Los borrados pierden el grafo anterior, por eso activan la suite completa.

Verificación del selector: `node --test scripts/ci-test-plan.test.mjs`. Límite del runner related: dos workers. No se cambia la configuración de las suites completas.

Referencias: [Vitest related](https://vitest.dev/guide/cli.html#vitest-related), [outputs entre jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/pass-job-outputs).

## Medición remota — 2026-10-23

Tiempo desde creación del run hasta completar el check requerido `test`; la columna de ejecución excluye la cola inicial del workflow. Corridas individuales, no un benchmark controlado.

| Caso | Total hasta test | Desde primer job | Cola inicial |
| --- | --- | --- | --- |
| [Referencia completa](https://github.com/Matitisco/iManager/actions/runs/40010040933) | 3m07s | 3m04s | 0m03s |
| [UI: ErrorBoundary.tsx](https://github.com/Matitisco/iManager/actions/runs/40011840728) | 2m00s | 1m58s | 0m02s |
| [Backend: ar-money.ts compartido](https://github.com/Matitisco/iManager/actions/runs/40011843831) | 3m53s | 3m11s | 0m42s |
| [Docs](https://github.com/Matitisco/iManager/actions/runs/40011703016) | 0m57s | 0m54s | 0m03s |

PRs temporales [#542](https://github.com/Matitisco/iManager/pull/542), [#543](https://github.com/Matitisco/iManager/pull/543) y [#545](https://github.com/Matitisco/iManager/pull/545), contra la propia rama CI para que el diff solo contenga el caso medido; cerrados sin merge. UI: 3 archivos/16 pruebas frontend, backend omitido y smoke conservado. Backend: 7 archivos/42 unitarios y 46 archivos/414 integraciones; smoke omitido. Docs: todas las suites omitidas y lint/test aprobados.

El helper monetario compartido alcanza todas las integraciones mediante `app`; esa corrida no mejoró la latencia y tuvo cola adicional. La selección conserva esas dependencias por seguridad. La primera prueba detectó la propiedad distinta del checkout en contenedores: el runner ahora autoriza únicamente su ruta actual para `git ls-files` (sin modificar la configuración global).

Verificación local: ocho casos Node del selector (incluye diff git real con commits múltiples, avance de base, rename, nombres con espacios/nueva línea, fallbacks y filesystem), actionlint y TypeScript frontend/backend aprobados; runner relacionado comprobado con 16 pruebas frontend y 42 backend. Sin build local.
