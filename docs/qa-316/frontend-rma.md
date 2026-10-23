# Devoluciones / RMA — rediseño aprobado #316

Referencias de solo lectura: `/workspace/redisenio-316/notas.md`, `actual/`, `figma/` y `src/add.css` / `src/html/`. Implementación sobre los componentes reales del frontend. Sin cambios de API, backend, Prisma ni dependencias.

## Criterios

1. **Alta:** Fecha primero con DatePicker (`type=text`, calendario propio), Venta, tarjeta de IMEI/garantía/importe y Motivo. Diagnóstico ausente en el alta y `diagnosis: null` al crear. Edición mantiene vínculo a venta y diagnóstico existentes. Día inicial del calendario local, sin desplazamiento UTC.
2. **Estado:** resumen con motivo integrado, segmentos iguales, diagnóstico y resolución/destino según estado, crédito y flujo de proveedor conservados. Seguimiento contiene solamente estado elegido, Ahora y nota del próximo paso. Guardar confirma; Cancelar descarta. Se conservan permisos sensibles, errores y bloqueo durante persistencia; CTA conserva su texto. El detalle espera datos antes de inicializar el borrador; mientras tanto usa ListSkeleton sin texto visible con aparición diferida.
3. **Historial:** reloj compartido de 44×44, sin texto visible, con nombre accesible, title y aria-haspopup. RMA utiliza `current.events` completos en una segunda capa de 480 px; móvil pantalla completa con Volver de 44 px. La lista histórica no aparece en el detalle principal. Cerrar/Escape/Volver conservan borradores y devuelven foco. Los demás usos compartidos conservan consulta y modal propios con acceso solo de reloj.
4. **Acciones:** Editar abre ReturnForm con id; Anular abre confirmación. Menú desktop de 200 px y fila resaltada; hoja móvil con código y cliente. Flechas, Inicio/Fin, Tab/Shift+Tab y Escape conservan el foco dentro del menú mediante la capa modal compartida.
5. **Anulado:** fondo err al 7 %, «—» incluso con importe histórico, píldora roja y sin ⋯/long press/contexto de acciones. Sigue disponible la consulta de solo lectura. Confirmación identifica código/cliente y utiliza `.btn2.danger.sheet-primary`; conserva movimientos registrados.
6. **Calendario:** `.dp-calendar.dp-inline` reemplaza `.dp-calendar.inline`. Verificado a 390 px en Reclamo, Registrar venta y Reportes; display block y grilla de siete columnas. No usa la utilidad Tailwind `.inline`.

## Verificación

- `npm run lint`: aprobado; `npm --prefix backend run lint`: aprobado.
- `npm run test:frontend`: 200 archivos / 1.666 pruebas aprobadas; pasada final con `--maxWorkers=2` en 186,74 s. Las pasadas previas completas sin límite pasaron en 86–88 s; una ejecución simultánea con build/lint tuvo timeouts y un worker que no inició. La pasada final aislada aprobó los 200 archivos sin cambiar timeouts ni configuración del CI. Cobertura de alta, payload, fechas, segunda capa desktop/móvil, timeline completo, foco/borradores, menú/permiso, anulados y confirmación. Regresiones de historial compartido en Stock/Ventas/Canjes/Clientes/Reparaciones.
- `npm run build`: aprobado. Vite advierte chunks mayores de 500 kB; no impide generar artefactos.
- `git diff --check`: aprobado. Sin comandos git de escritura ni E2E nuevos.
- Revisión con Chromium de la app local en `127.0.0.1:4330`, a 1440×900 y 390×844. Capturas y logs de trabajo fuera del repo: `/workspace/qa-316/work/`.
- Calendario de Reportes móvil: 358×373 px, 42 días y display grid; sin overflow horizontal. Alta de ventas y Reclamo también usan dp-inline con display block.
- Resuelto móvil: hoja de 742,72 px (`88dvh`); scroll interno alcanzable y footer fijo en y=769..844 antes/después del scroll. Sin overflow horizontal.

## Diferencias respecto de las imágenes

- Los fixtures locales tienen clientes, fechas, IMEI, garantías, importes, estados y cantidad/contenido de eventos diferentes. Se muestran los datos reales del fixture; el historial no inventa las tres notas de ejemplo. Su altura desktop depende del contenido.
- Las referencias de fecha abierta y Resuelto móviles son más altas que 844 px, y Resuelto desktop supera el máximo solicitado. En el viewport pedido se aplica `min(88dvh, 100dvh - 48px)` con scroll interno; por eso no aparecen todos los campos simultáneamente.
- El shell existente mantiene nombre de tienda/usuario, cotización, contadores en navegación y geometría de la barra inferior. Esos elementos compartidos quedan fuera del ajuste de RMA.
- Se conservan pequeños desajustes de métricas tipográficas/espaciado respecto de la exportación de Figma (aprox. 7 px en el inicio de la hoja móvil de estado); controles, jerarquía y acciones siguen los tokens y medidas reales.

La CLI `openspec` no está instalada en el entorno. Se leyeron y actualizaron directamente los artefactos del change existente `redesign-return-claims-483`; no se archivó.

## Archivos tocados

Implementación:

- `src/desk/overlays/return-case.tsx`
- `src/desk/screens/ReturnsScreen.tsx`
- `src/desk/DeskOverlays.tsx`
- `src/desk/RecordHistoryButton.tsx`
- `src/desk/date-picker.tsx`
- `src/desk/overlays/operation.tsx`
- `src/desk/ui.tsx`
- `src/desk/desk.css`

Pruebas:

- `src/desk/overlays/return-case.test.tsx`
- `src/desk/screens/returns-actions.test.tsx`
- `src/desk/RecordHistoryButton.test.tsx`
- `src/desk/date-picker.test.tsx`
- `src/desk/overlays/tracking-history.test.tsx`
- `src/desk/overlays/client-repair-history.test.tsx`

Documentación:

- `PROJECT_STATUS.md`
- `openspec/changes/redesign-return-claims-483/design.md`
- `openspec/changes/redesign-return-claims-483/specs/return-claims/spec.md`
- `openspec/changes/redesign-return-claims-483/tasks.md`
- `docs/qa-316/frontend-rma.md`
