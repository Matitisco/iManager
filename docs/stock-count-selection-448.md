# Control de stock: selección y revisión de diferencias (#448)

## Reproducción y versión

- Fecha: 21/10/2026. Base de trabajo y `origin/main`: `d215d8a7f19376744900414a789d185aee3dad0f`.
- En esa base, `showClosed` selecciona todos los faltantes y sobrantes. Los dos botones de ajuste envían ambas selecciones, incluso si solo se está viendo un grupo, sin confirmación. Se reprodujo ejecutando ese componente original con datos sintéticos; las capturas antes muestran doce filas seleccionadas al consultar un cierre sin escaneos.
- Despliegue consultado por HTTP sin caché de navegador/PWA: `https://app.imanager.com.ar/`, respuesta 200, 21/10/2026 18:40 UTC. `/version.json`: `buildId=60658746e56ddaa2`; assets `index-9zHD6QKo.js` y `index-DxBvOjBy.css`. El JS servido conserva «Archivar · Faltante» y «Ajustar al conteo». El buildId no acredita correspondencia con un commit específico.
- No se dispuso de una sesión autenticada para recorrer los conteos reales del despliegue. La reproducción funcional se hizo contra el código de main con datos sintéticos, sin consultas autenticadas ni operaciones sobre producción.

## Contrato de cobertura

Se documentó antes de implementar en [design.md](../openspec/changes/fix-stock-count-selection-448/design.md). El cierre existente no certifica que se haya recorrido todo el local:

- `scanCount` cuenta IMEI no repetidos, incluyendo sobrantes y vendidos; no se compara contra una cantidad esperada para inferir completitud.
- Cero escaneos muestra «Sin escaneos» y aclara que los faltantes no confirman pérdidas.
- Con escaneos y faltantes muestra «Conteo con equipos sin escanear» y las cantidades registradas/pendientes de revisión.
- Sin faltantes muestra «Sin faltantes en la comparación», sin afirmar completitud física.
- Los excluidos sin IMEI aparecen en un bloque independiente con su cantidad; no pasan a faltantes ni se mezclan con vendidos. Se conserva el dato histórico `excludedNoImei`.

No hay cambios de backend, API, schema ni clasificación histórica. Los resultados abiertos siguen a ciegas.

## Comportamiento

Abrir, reabrir, cambiar de conteo o cambiar de grupo vacía la selección. Pulsar el grupo actual la conserva. Las etiquetas de fila permiten seleccionar con un área táctil de al menos 44 px y el nombre accesible incluye el final del IMEI para distinguir modelos repetidos.

La acción indica «Archivar N equipos seleccionados» o «Cargar N equipos seleccionados» y está deshabilitada con cero seleccionados. Solo propietario/socio con Inventario puede seleccionarlos y resolver. Empleados y resultados ya resueltos quedan en consulta.

El Sheet compartido de #447 confirma cantidad, lista de equipos e IMEI completos. El archivo muestra el motivo fijo «Faltante»; cargar informa disponibilidad y datos pendientes. Cancelar no escribe. Error conserva confirmación y selección, lleva el aviso a la vista y permite reintentar; mientras se guarda se bloquean cierre y repetición.

Se envía solo la selección del grupo visible. Se conserva la resolución única del backend: el control queda ajustado, los demás equipos no cambian y no se puede volver a ajustar ese mismo control. Esto se explica en la confirmación. «Solo dejar registrado» envía listas vacías aun con selección y no recarga/modifica inventario.

## Validación

- `StockCountScreen.test.tsx`: 22 pruebas, incluidas apertura/reapertura, otro conteo, grupos, registrar con selección, confirmar/cancelar, error/reintento, permisos, cierre sin escaneos, comparación parcial/sin faltantes, excluidos, resultados resueltos y doble envío en móvil/desktop.
- `node scripts/test-stock-count-review.mjs`: prueba automatizada del componente real y el Sheet compartido, servicios sintéticos, sin servidor de la app ni backend/DB. Usa Vite solo para servir el fixture temporal, que se elimina al finalizar. Verifica 390×844, 1440×900 y 1536×640, ausencia de overflow, blancos táctiles, scroll del cuerpo, footer accesible, cancelación sin solicitud, error visible tras hacer scroll y estados sin escaneos/parcial/sin faltantes.
- Se corrigió una carrera preexistente en `sheet-compatibility.test.ts`: la animación podía terminar durante `setContent` antes de que la prueba la pausara. Ahora reinicia la misma animación CSS y la pausa en una sola tarea del navegador, conservando todas las mediciones de tamaño y posición.
- La primera integración reveló que el PostgreSQL local estaba atrasado (`StoreMember.removedAt` y otras columnas/tablas faltantes). Se inspeccionó `prisma migrate diff`: solo adiciones, sin unicidades nuevas en tablas existentes. Se sincronizó exclusivamente `127.0.0.1:5432/imanager_test` mediante `prisma db push --skip-generate`, sin aceptar pérdida de datos ni cambiar el schema del repositorio.

Resultados finales aprobados:

| Comando | Resultado |
| --- | --- |
| `npm run test:frontend -- --maxWorkers=2` | 156 archivos, 1114 pruebas |
| `npm --prefix backend run test:unit` | 76 archivos, 516 pruebas |
| `npm --prefix backend run test:integration` | 39 archivos, 322 pruebas; solo PostgreSQL local |
| `npm run lint` y `npm --prefix backend run lint` en paralelo | Ambos sin errores de TypeScript |
| `node scripts/test-stock-count-review.mjs` | Los tres viewports aprobados |
| `git diff --check` | Sin errores |

Para reproducir integración, definir `DATABASE_URL` apuntando únicamente al PostgreSQL local de pruebas. No se ejecutó la suite E2E completa de la app; la validación visual automatizada usa el componente aislado.

## Evidencia visual sintética

| Estado | Móvil 390×844 | Desktop 1440×900 | Desktop bajo 1536×640 |
| --- | --- | --- | --- |
| Antes: cero escaneos | [Captura](pr-shots/448-before-390.png) | [Captura](pr-shots/448-before-1440.png) | — |
| Después: cero escaneos | [Captura](pr-shots/448-after-390.png) | [Captura](pr-shots/448-after-1440.png) | — |
| Confirmación: cantidad y motivo | [Captura](pr-shots/448-confirm-start-390.png) | [Captura](pr-shots/448-confirm-start-1440.png) | [Captura](pr-shots/448-confirm-start-1536.png) |
| Confirmación: footer tras scroll | [Captura](pr-shots/448-confirm-390.png) | [Captura](pr-shots/448-confirm-1440.png) | [Captura](pr-shots/448-confirm-1536.png) |

La evidencia corresponde a Chromium con viewport móvil, no a Safari ni a un iPhone físico. No se ejecutó un despliegue local completo, build, commit, push ni cambios en producción.
