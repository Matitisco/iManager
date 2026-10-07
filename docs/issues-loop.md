# Loop de issues — 2026-10-07

Coordinación del agente main con un único subagente GPT-6.1 Sol, razonamiento xhigh. Se entrega un issue por vez y se revisa su cumplimiento antes de publicarlo en `main` y cerrarlo en GitHub.

Instrucciones del usuario: no hacer preguntas; registrar decisiones y consultas pendientes en `docs/issues-loop-pendientes.md`; eliminar OpenSpec del proyecto y no usar sus workflows. No ejecutar builds ni incluir los tres elementos sin seguimiento preexistentes.

## Preparación

- [x] Integrar los avances de `hifi-desk` y las correcciones existentes de `main`, conservando ambos historiales.
- [x] Quitar OpenSpec y sincronizar `AGENTS.md` con `CLAUDE.md`.
- [x] Verificar la preparación: frontend 239/239, backend unit 77/77, TableEngine revalidado 30/30, E2E Canjes 1/1 en DB local aislada y ambos lints aprobados.
- [x] Publicar la preparación: `20bc6ee` en `origin/main`.
- [x] CI completa de la preparación aprobada: [run 37639541402](https://github.com/Matitisco/iManager/actions/runs/37639541402), incluidos lints, frontend, backend unit/integración y E2E.

## Cola secuencial

| Orden | Issue | Alcance | Estado | Evidencia / commit |
| --- | --- | --- | --- | --- |
| 1 | #62 | Recuperar login al cancelar Google | Cerrado | `22eaf75`; Login 13/13: cancelación, reintento, ambos modos y promesas tardías; GitHub cerrado 2026-10-07 |
| 2 | #80 | Inventario: 10 equipos por página | Cerrado | `d1a7da6`; 7/7 pager + pantalla, navegación de 12 equipos, filtros y última página vacía |
| 3 | #81 | Batería: colores y animaciones de referencia | Cerrado | `d6270a7`; 10/10 pruebas + 7 límites/rangos/fracciones; referencia y revisión visual contrastadas |
| 4 | #85 | Rol Empleado en toda la interfaz | Cerrado | `b976e4c`; 22/22 pruebas de acceso/configuración; sin Agente/Vendedor en src |
| 5 | #99 | Logo de cajita con fondo amarillo | Cerrado | `7015923`; Box en sidebar/salida, amarillo #FFD000; QA visual 1440/1024 y sesión cerrada; ambos lints |
| 6 | #98 | Editor de estados acorde a demo estática | Cerrado | `d9018ec`; QA comparativa 1440/680, 11/11 FE, 81/81 BE y ambos lints; reasignación canónica persistida/reload |
| 7 | #97 | Canjes en tabla | Cerrado | `3f058ec`; 7/7 FE/pager, E2E 1/1, ambos lints; CRUD/reload local y QA 1440/1024 |
| 8 | #104 | Todas las tablas: 8 ítems por página | Verificado; publicación en main | 13/13 pruebas de las cuatro tablas y paginador; TypeScript frontend/backend aprobado. GitHub ya cerrado por PR #112 a hifi-desk |
| 9 | #100 | Equipo libre con autocompletado en ventas | Pendiente | |
| 10 | #103 | Filtros por columna en Ventas y Clientes | Pendiente | |
| 11 | #88 | Permisos desde cada pantalla/sección | Pendiente | |
| 12 | #102 | Permisos al tocar un miembro | Pendiente | |
| 13 | #71 | Invitaciones y permisos integrales | Pendiente | |
| 14 | #63 | Código requerido para cuenta nueva | Pendiente | |
| 15 | #101 | Conversión y entrada de importes ARS/USD | Pendiente | |
| 16 | #70 | CRUD, edición, selección, borrado y persistencia de las 4 tablas | Pendiente | |
| 17 | #34 | Mejorar fluidez | Pendiente | |

## Excluido por el usuario

El issue #89, «Funcionalidad: definir el flujo integrado de Inventario, Ventas, Canjes y Clientes», permanece abierto y no se implementa en este loop.

## Actualizaciones de alcance

Se detectó el issue #104 durante la ejecución. Actualiza #80 a 8 ítems por página y extiende el límite a Inventario, Ventas, Canjes y Clientes. Se delega después de #97; el cierre anterior de #80 conserva la evidencia del criterio vigente en ese momento. La cola contiene ahora 17 issues a resolver.

## Hallazgos para la revisión integral #70

- La QA de #97 reprodujo una carrera preexistente en `seedMissing`: dos consultas iniciales concurrentes de catálogos de una tienda vacía pueden provocar `P2002`. Resolver el alta concurrente y comprobarla antes de finalizar #70.
- Revisar la fuente de opciones de catálogos en las cuatro tablas: al contar con el catálogo persistido no deben reaparecer valores predeterminados eliminados. La tabla nueva de Canjes ya usa el catálogo disponible y conserva valores históricos de sus registros.

## Criterio de cierre

Cada issue se contrasta con su descripción actual y criterios de aceptación. Se corrigen brechas, se ejecutan verificaciones pertinentes sin build, se publica en `main` y se cierra con evidencia. Un impedimento real se documenta; no se cierra un issue por trabajo incompleto. La lista de GitHub se vuelve a consultar antes de finalizar para comprobar que solo permanece el issue excluido.

## Continuación — estado contrastado con GitHub

La nueva consulta muestra abiertos #71, #88, #101 y el excluido #89. Los otros issues de la cola anterior ya fueron cerrados en GitHub; algunos avances fueron publicados en `hifi-desk` y se integran en `main` conservando historial. Las etiquetas Pendiente de esa cola son el registro de la ejecución anterior, no la lista actual de GitHub.

| Grupo | Alcance | Estado |
| --- | --- | --- |
| #71 + #88 | Invitaciones fiables y permisos por usuario/pantalla | Delegado a subagente nuevo GPT-6.1 Sol xhigh |
| #101 | Conversión ARS/USD, entradas y persistencia histórica | En auditoría del coordinador; siguiente subagente |
| #89 | Flujo integrado | Excluido expresamente |

La paginación local preexistente de ocho filas se incorpora tras revisar sus cambios y aprobar 13 pruebas pertinentes y ambos lints. Se preservan los directorios de referencias y `.chrome-now.png` sin seguimiento.
