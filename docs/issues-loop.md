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
| 2 | #80 | Inventario: 10 equipos por página | Verificado; listo para cierre | `47cb20c` integrado; 7/7 pager + pantalla, navegación de 12 equipos, filtros y última página vacía |
| 3 | #81 | Batería: colores y animaciones de referencia | Pendiente | |
| 4 | #85 | Rol Empleado en toda la interfaz | Pendiente | |
| 5 | #99 | Logo de cajita con fondo amarillo | Pendiente | |
| 6 | #98 | Editor de estados acorde a demo estática | Pendiente | |
| 7 | #97 | Canjes en tabla | Pendiente | |
| 8 | #100 | Equipo libre con autocompletado en ventas | Pendiente | |
| 9 | #103 | Filtros por columna en Ventas y Clientes | Pendiente | |
| 10 | #88 | Permisos desde cada pantalla/sección | Pendiente | |
| 11 | #102 | Permisos al tocar un miembro | Pendiente | |
| 12 | #71 | Invitaciones y permisos integrales | Pendiente | |
| 13 | #63 | Código requerido para cuenta nueva | Pendiente | |
| 14 | #101 | Conversión y entrada de importes ARS/USD | Pendiente | |
| 15 | #70 | CRUD, edición, selección, borrado y persistencia de las 4 tablas | Pendiente | |
| 16 | #34 | Mejorar fluidez | Pendiente | |

## Excluido por el usuario

El issue #89, «Funcionalidad: definir el flujo integrado de Inventario, Ventas, Canjes y Clientes», permanece abierto y no se implementa en este loop.

## Criterio de cierre

Cada issue se contrasta con su descripción actual y criterios de aceptación. Se corrigen brechas, se ejecutan verificaciones pertinentes sin build, se publica en `main` y se cierra con evidencia. Un impedimento real se documenta; no se cierra un issue por trabajo incompleto. La lista de GitHub se vuelve a consultar antes de finalizar para comprobar que solo permanece el issue excluido.
