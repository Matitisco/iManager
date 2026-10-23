# fix: completar Total, rangos y carga del Dashboard

El Dashboard permite consultar **Total** sin límites de fecha, oculta comparaciones cuando no hay período previo y mantiene coherentes las métricas comerciales con el rango elegido. Ventas recientes sigue el mismo rango y conserva el layout de #512.

El primer pintado espera sesión confirmada, permisos, Primeros pasos, las cuatro listas de red y overview. La caché deja de aparecer como una cifra confirmada antes de la revalidación. Se mantienen los estilos y el markup de #512 con Skeleton y reservas mínimas de layout para evitar parpadeos. El selector muestra cinco chips completos y admite wrap en móvil.

## Auditoría del rango

| Elemento | Sigue el rango |
| --- | --- |
| Ventas, margen y porcentaje de margen | Sí, ventas completadas no anuladas del período. |
| Equipos vendidos | Sí; mismo criterio financiero y conteo equivalente sin acceso a finanzas. |
| Tendencia y medios de pago, importes y porcentajes | Sí, misma respuesta de overview. Total usa meses argentinos; se condensan históricos extensos en hasta doce grupos de meses. |
| Ventas recientes | Sí, hasta cinco registros más recientes del período en desktop y cuatro en celular, incluyendo pendientes y anulados con su estado visible. |
| Stock disponible, total y barra | **No**: existencias actuales, sin reconstrucción histórica. |
| Canjes en curso | **No**: trabajo actualmente pendiente, aunque se haya creado antes del período. Se excluyen anulados. |
| Saldos a cobrar | **No**: deuda neta pendiente de todos los clientes, descontando créditos; no se ocultan deudas antiguas. |

Las métricas de listas sin permiso de lectura se omiten, evitando cifras cero por falta de acceso.

Stock, canjes y saldos permanecen visibles y sin atenuación al aplicar otro rango; no muestran variación. No se agregan labels ni subtítulos explicativos. Total consulta `rangeKey=all_time` sin fechas; no crea una ventana anterior. Las bases de comparación ausentes o menores que una unidad ocultan el badge.

Detalle: [auditoría](auditoria.md).

## Validación

- `npm run lint`: aprobado (typecheck/lint frontend).
- `npm --prefix backend run lint`: aprobado (typecheck/lint backend).
- `npx vitest run`: **196 archivos, 1.585 pruebas aprobadas**.
- `npm --prefix backend run test:unit`: **81 archivos, 572 pruebas aprobadas**.
- `git diff --check`: aprobado.
- Comparación con HEAD/origin/main (#512): `ui.tsx`, `desk.css` y los cuatro archivos E2E restaurados íntegramente; markup de filas de ventas, KPI y colores de pagos coincidentes. Sin ejecutar E2E.

Sin cambios de Prisma, build, commits ni E2E nuevos. Los selectores E2E existentes conservan el layout de #512. Se actualizan pruebas de componentes, fechas, carga, servicio y backend.

Documentación y body preparados en `docs/qa-dashv3`. Cambios en el working tree de `feat/dashboard-total-ajustes`, sin commit.
