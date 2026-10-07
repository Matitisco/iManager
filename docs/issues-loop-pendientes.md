# Decisiones y pendientes del ciclo de issues

Documento de decisiones tomadas sin interrumpir el trabajo con preguntas, según la instrucción del usuario. La bitácora de ejecución está en [issues-loop.md](issues-loop.md).

## Preparación — 2026-10-07

- **Integración:** se actualizan las ramas locales por fast-forward y se integra `hifi-desk` en `main` mediante merge. Se preservan los siete commits recientes de cada rama; no se reescribe el historial ni se crean ramas o PRs.
- **Conflicto de TableEngine:** se conserva la paginación y el pegado inmediato en paralelo de `main`, junto con las animaciones desk. El resaltado usa la misma respuesta de refresco validada por el hook, sin consultar dos veces ni reemplazar su protección contra respuestas obsoletas.
- **Prueba de canjes:** se conservan las aserciones de persistencia vía API y después de recargar. Los controles y el título se adaptan a la interfaz desk actual; no se sustituye la validación de negocio por comprobaciones superficiales.
- **Retiro del flujo anterior:** se eliminan únicamente sus archivos y skills dentro de este repositorio; ninguna herramienta global ni skill fuera del proyecto se modifica. `AGENTS.md` y `CLAUDE.md` quedan sincronizados.
- **Pruebas en Windows:** la zona horaria ya está en `vitest.config.ts`; se retira el prefijo POSIX redundante de los scripts npm para poder ejecutarlos en ambos sistemas.
- **Alcance:** el issue #89 está excluido. Esta preparación no cierra ni aborda un issue individual.

### Validación y pendientes

- Lint frontend/backend aprobado tras regenerar Prisma Client local para los campos `Store.email` y `Store.instagram` incorporados en hi-fi. La regeneración no accede a una base de datos ni ejecuta un build.
- Revisión del coordinador: suite completa frontend 239/239 y backend unit 77/77 aprobadas. Los dos timeouts iniciales de backend desaparecieron con un solo worker; no se alteraron los tests para ocultarlos.
- Revalidación de TableEngine: 30/30 aprobadas, incluidas animación de filas temporales y persistidas, pegado inmediato, copia entre páginas, tamaño de página y ausencia de refresco duplicado.
- E2E de canjes: 1/1 aprobado contra `postgresql://127.0.0.1:5432/imanager_issues_loop_test`, con comprobación de persistencia API y después de recargar. El schema se sincronizó únicamente en esa base local aislada.
- La revisión automática bloqueó los comandos de borrado recursivo. Se retiraron 200 archivos mediante parches con rutas exactas y luego 138 directorios vacíos verificados mediante eliminación no recursiva. No queda instalación del flujo anterior dentro del proyecto.
- Sin decisiones de producto pendientes en esta preparación. La publicación del merge queda a cargo del coordinador, que continúa con los issues secuencialmente.

## Issue #62 — recuperación al cerrar Google — 2026-10-07

- **Solicitud:** [#62](https://github.com/Matitisco/iManager/issues/62), leída con `gh issue view 62 --json number,title,body,comments,url`. Al cerrar el popup sin autenticarse, login y registro deben recuperar sus controles y permitir otro intento.
- **Resultado:** ya resuelto por `ab107ef`, integrado en el `main` activo `20bc6ee`. `src/App.tsx` monta el mismo `Login` antes de autenticar, y login y registro comparten `handleGoogleLogin`. No se identificó una brecha que requiera otra modificación de runtime o pruebas.
- **Criterios comprobados:** foco de ventana y vuelta a una pestaña visible restauran el botón antes de que Firebase resuelva; `auth/popup-closed-by-user` y `auth/cancelled-popup-request` terminan sin error; se permite reintentar desde login y registro; una promesa antigua que resuelve o rechaza no cambia el estado del reintento; se eliminan listeners al desmontar. El envío por email mantiene su propio estado pendiente.
- **Evidencia:** `npm run test:frontend -- src/pages/Login.test.tsx` aprobado, 13/13 pruebas. Incluye ambos modos, foco/visibilidad, cancelaciones, reintentos, respuestas tardías, error real del intento vigente y limpieza. El baseline de lint frontend/backend y suites completas ya pasó en la preparación publicada; solo se agrega esta documentación.
- **Decisión:** conservar la corrección existente y registrar la verificación, sin crear cambios redundantes. Puede cerrarse el issue tras la revisión del coordinador.
- **Límite:** las pruebas controlan promesas y eventos del navegador; no abren un popup real de una cuenta Google. El adaptador de producción mantiene `signInWithPopup` de Firebase y los errores se propagan al componente.
