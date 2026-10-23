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
