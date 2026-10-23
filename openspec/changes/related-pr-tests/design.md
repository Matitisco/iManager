## Context
CI ya tiene un agregador llamado test requerido por branch protection. Frontend incluye regresiones que leen fuentes/CSS sin imports. Integraciones backend pueden importar app y afectar varios módulos.

## Decisions
- Un script Node sin dependencias obtiene nombres NUL-delimitados con git diff merge-base...head, sin detectar renames: un rename se trata como borrado+alta.
- PRs usan related para ambos proyectos; backend agrega pruebas del módulo tocado y conserva dependientes transitivos del grafo (incluida app).
- Regresiones frontend que leen archivos se agregan a los inputs porque Vitest no observa dependencias de filesystem.
- Config global/dependencias e infraestructura CI desconocida activan suites completas. Borrados activan la suite del proyecto: el grafo actual perdió los imports eliminados.
- No se interpola contenido del PR en shell: JSON por env y spawn con arrays.
- Frontend related usa un job; suite completa conserva dos shards. Smoke se omite para backend puro/docs. Lint permanece incondicional.
- Pruebas remotas usan ramas temporales contra la rama de implementación para medir diff UI/backend sin que el propio cambio de workflow fuerce suite completa; cerrar sin merge.

## Risks
Related depende de imports estáticos. Selección conservadora de pruebas de filesystem y módulos, respaldos completos para configs/borrados/archivos desconocidos, suite completa en main/nightly.
