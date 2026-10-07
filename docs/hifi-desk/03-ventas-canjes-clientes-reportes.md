# Auditoría hi-fi desktop — Ventas, Canjes, Clientes, Reportes

Referencia: `iManager-desktop-pantallas-v2/imanager-desk.html` (capa desktop desde la línea ~1593 + sistema de estados 1720-1837) y capturas 13 a 19.
Implementación: `src/desk/` (screens/SalesScreen.tsx, screens/TradeInsScreen.tsx, screens/ClientsScreen.tsx, screens/ReportsScreen.tsx, DeskOverlays.tsx, ui.tsx, desk.css, format.ts).

Convenciones: "Estático" = HTML de referencia (número de línea). "Implementado" = archivo React:línea. Las diferencias de datos de ejemplo vs. datos reales no se listan, salvo que cambien qué se muestra o cómo se calcula.

> Nota transversal: varias diferencias visuales de modales (labels, inputs, botones) vienen de la base compartida (`Sheet`, `Field`, `Segs`, `Actions` en `ui.tsx` + tokens de `desk.css`). Están agrupadas en **MV-01 a MV-04** y aplican también a los modales de canje y cliente; no se repiten en esas secciones.

---

## Ventas

1. **VE-01** — **Severidad:** Alta
   - **Estático:** `veList()`/`veTable()` 1652-1658 listan **todas** las ventas (incluidas las `Cancelada`; `VE_ST` 1232 incluye `Cancelada` y `pillCls` 984 le da estilo `no`).
   - **Implementado:** `SalesScreen.tsx:24-27` define `periodSales` excluyendo `status !== 'CANCELADA'` y la tabla (`rows`, 37-42) se construye sobre `periodSales`. Las ventas canceladas desaparecen de la tabla: no se pueden ver, reabrir, editar ni eliminar desde Ventas.
   - **Cómo corregir:** separar la base de KPIs de la base de la tabla:
     ```ts
     const inRange = sales.filter((s) => parseOk(s.date) ? inPeriod(s.date, bounds.start, bounds.end) : period === 'Mes');
     const periodSales = inRange.filter((s) => s.status !== 'CANCELADA'); // KPIs
     const rows = inRange.filter(/* query */);                            // tabla
     ```
     y el contador del header de la tarjeta queda `rows.length de inRange.length`.

2. **VE-02** — **Severidad:** Media
   - **Estático:** columna Fecha muestra `v.when` en formato `DD/MM/AAAA` (`05/10/2026`, datos 946-948; celda en 1655; captura 13).
   - **Implementado:** `SalesScreen.tsx:92` imprime `sale.date` crudo, que viene de `Sale.dateLabel` del backend (`Intl es-AR {day:'2-digit', month:'short', year:'numeric'}` → p. ej. `05 oct 2026`, `backend/src/modules/sales/sales.service.ts:151-155`).
   - **Cómo corregir:** agregar en `format.ts`:
     ```ts
     export function formatShortDate(value: string): string {
       const d = parseAppDate(value);
       return d ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : value || '—';
     }
     ```
     y usar `formatShortDate(sale.date)` en la tabla, en el subtítulo del detalle de venta (`DeskOverlays.tsx:294`) y en la lista de Reportes (`ReportsScreen.tsx:77`).

3. **VE-03** — **Severidad:** Media
   - **Estático:** 3.ª tarjeta KPI: eyebrow `Margen bruto est.`, valor `fmt(round(tot*0.2/1e4)*1e4)`, sub `<small class="mut">≈ 20% del total</small>` (1664).
   - **Implementado:** `SalesScreen.tsx:63-67`: eyebrow `Margen bruto` (sin "est."), valor `total - costo` o `—`, sub `precio menos costo` / `Cargá el costo en el equipo`.
   - **Cómo corregir:** el cálculo real (precio − `Product.cost`) es válido y preferible a la estimación fija del 20%; alinear solo el copy: eyebrow `Margen bruto est.` (o dejar "Margen bruto" si se decide que deja de ser estimado, pero documentarlo) y sub `≈ {Math.round(margin / total * 100)}% del total` cuando `hasCost && total > 0`. Mantener `Cargá el costo en el equipo` solo cuando no hay costo cargado.

4. **VE-04** — **Severidad:** Media
   - **Estático:** selector de período `<button class="dsel">Mes {I.down}</button>` (1663) con chevron SVG de 12 px (919). Al hacer clic abre `popmenu(['Semana','Mes','Año'])` (1358) como overlay `.ov.menu` (fondo transparente, 1012-1014; posición fija arriba a la derecha `padding:140px 48px 0 0`, 826), menú de 200 px, radio 18 px, ítems 14 px/700 separados con `border-top`, ítem activo con `✓` (`.popmenu button.on::after`, 646). Clic fuera cierra (`data-act="ov-close"`).
   - **Implementado:** `ui.tsx:51-66` (`MenuButton`): label `` `${period} ▾` `` (carácter unicode, `SalesScreen.tsx:55`), menú `.menu` anclado bajo el botón (`desk.css:68-70`) con resaltado lima en hover/activo y sin `✓`. No cierra con clic fuera ni con Escape.
   - **Cómo corregir:** en `MenuButton` reemplazar `▾` por el SVG `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>`; poner el botón directamente con clase `dsel` (36 px, radio 999 px, 13 px/700, como `.dsel` estático 766); agregar listener `mousedown` en `document` + `keydown Escape` para cerrar; en `.menu button.on::after { content:'✓'; margin-left:auto; font-weight:800 }` y `.menu button + button { border-top:1px solid var(--border) }`, ancho 200 px, radio 18 px, padding de ítem `13px 12px`, 14 px.

5. **VE-05** — **Severidad:** Media
   - **Estático:** `dimp()` = `<button class="dbtn s">{I.up()}Importar</button>` (1608; SVG flecha + bandeja, 910) y `dcta()` = `<button class="dbtn p">{I.plus('#fff')}Registrar venta</button>` (1610; SVG "+" 918). `.dbtn svg {16×16}` (765). Captura 13.
   - **Implementado:** `SalesScreen.tsx:56-57` usa texto `↑ Importar` y `+ Registrar venta` (caracteres, no SVG). Igual en `TradeInsScreen.tsx:45-46` y `ClientsScreen.tsx:31-32`.
   - **Cómo corregir:** crear en `ui.tsx` `ImportButton` y `CtaButton` con los SVG del estático:
     ```tsx
     const IconUp = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7 8.5l5-5 5 5M5 20h14"/></svg>;
     const IconPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
     ```
     y usarlos en las tres pantallas.

6. **VE-06** — **Severidad:** Baja
   - **Estático:** `.dstat .eb` 12 px/700 secundario, `.big` 26 px/800 con `margin-bottom:8px` (800-801).
   - **Implementado:** `desk.css:143-144`: `.eb` 13 px/600, `.big` 28 px sin margen inferior (el pill `N ventas` y los `small` quedan pegados al número).
   - **Cómo corregir:** `.dstat .eb { font-size:12px; font-weight:700 }` `.dstat .big { font-size:26px; margin-bottom:8px }`.

7. **VE-07** — **Severidad:** Baja
   - **Estático:** `.dcard .dtable th:first-child, .dcard .dtable td:first-child { padding-left:20px }` (784), alineando la primera columna con el título "Ventas del período" (`.dch.pad` 20 px).
   - **Implementado:** regla ausente en `desk.css:121-129` → primera columna a 16 px, desalineada del título. Aplica a Clientes también.
   - **Cómo corregir:** agregar la regla en `desk.css`.

8. **VE-08** — **Severidad:** Baja
   - **Estático:** ícono de búsqueda `I.search('#9CA3AF')` 18 px, `circle r=6.5`, `path M20 20l-4-4`, stroke 2.1 (907, 1607).
   - **Implementado:** `ui.tsx:124-130` 16 px, `r=7`, `M20 20l-3.5-3.5`, stroke 2.2.
   - **Cómo corregir:** copiar el SVG estático en `SearchIcon` (`width/height 18`).

9. **VE-09** — **Severidad:** Baja
   - **Estático:** estado vacío `.wempty` con fondo `#fff`, borde `1px dashed #D9DCE1`, radio 20 px, padding `28px 10px` (512, 709).
   - **Implementado:** `desk.css:157` borde `1.5px dashed #D6D9DE`, radio 14 px, fondo transparente.
   - **Cómo corregir:** separar `.wempty` de `.dempty` en `desk.css` con los valores estáticos; dentro de `.dcard.flush` darle `margin:16px 20px 20px`.

10. **VE-10** — **Severidad:** Baja
    - **Estático:** pill de estado: `.spill` 11 px/700, `padding:3px 9px`, sin altura fija (569); color custom `.spill.cst` = `color-mix(var(--pc) 14%, #fff)` / texto `78%` (852).
    - **Implementado:** `desk.css:136` `height:26px; padding:0 10px; font-size:12px; font-weight:800`, mezcla 16% / 72%. El pill React es ~20% más grande que en la captura 13.
    - **Cómo corregir:** `.spill { display:inline-flex; align-items:center; font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; white-space:nowrap; background:color-mix(in srgb, var(--pc) 14%, #fff); color:color-mix(in srgb, var(--pc) 78%, #16181D) }` (sin `height`).

---

## Modales de venta

1. **MV-01** — **Severidad:** Media (base compartida de todos los modales)
   - **Estático:** etiquetas de campo `.fl > span` en **mayúsculas**, 11 px/700, `letter-spacing:.06em`, color `--section #9AA0AA` (616; capturas 14 y 18: "EQUIPO", "CLIENTE", "FORMA DE PAGO"). Inputs/select 48 px, radio 14 px, 15 px/600, fondo `--row #F0F1F3`, borde `#E6E8EC` (466, 617, 702).
   - **Implementado:** `desk.css:209` `.fl span` 12 px/800, sin uppercase, color primario; `desk.css:210` inputs 42 px, radio 12 px, 14 px; `--row` = `#F7F8FA` (`desk.css:15`, igual al fondo de página, así que los inputs casi no se distinguen). Además `.fl span` también matchea el `<span />` vacío que se pasa como hijo en los labels de segmentados (`DeskOverlays.tsx:181, 187, 197, 257, 260, 353`) y le agrega 6 px extra.
   - **Cómo corregir:** en `desk.css`: `--row:#F0F1F3;` `.fl > span { display:block; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#9AA0AA; margin-bottom:6px }` (usar `>` para no afectar hijos) y `.fl input, .fl select { height:48px; border-radius:14px; padding:0 14px; font-size:15px }`. En `Field` permitir `children` opcional y dejar de pasar `<span />`.

2. **MV-02** — **Severidad:** Media (base compartida)
   - **Estático:** botones de acción `.btn2` 52 px, **radio 999 px (pastilla)**, 15 px/700; `.btn2.p` con sombra `0 6px 18px rgba(0,0,0,.18)`; `.btn2.s` con borde `1.5px solid var(--border)` y fondo `#F0F1F3` (581-583, 707). `.sacts` `grid-template-columns:1fr 1.5fr; margin-top:16px` (626). Captura 14: "Cancelar" / "Confirmar venta" son pastillas.
   - **Implementado:** `desk.css:218-222`: 46 px, radio 12 px, 14 px/800, sin sombra ni borde; `.sacts` `1fr 1.4fr`, `margin-top:8px`.
   - **Cómo corregir:** `.btn2 { height:52px; border-radius:999px; font-size:15px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px }` `.btn2.p { box-shadow:0 6px 18px rgba(0,0,0,.18) }` `.btn2.s { border:1.5px solid var(--border) }` `.btn2:disabled { opacity:.55 }` `.sacts { grid-template-columns:1fr 1.5fr; margin-top:16px }`.

3. **MV-03** — **Severidad:** Media (base compartida)
   - **Estático:** overlay `rgba(17,17,17,.45)` con `fadeIn .18s` (63, 66, 475); modal `pop .2s cubic-bezier(.2,.8,.2,1)` (68, 824). Título `h3` 22 px/800 `letter-spacing:-.01em; margin-bottom:6px`; `.sub` 14 px/**500**, `line-height:1.4`, `margin-bottom:16px` (71-72). `.kv` `padding:12px 2px`, sin borde superior en el primero (628-629). `.dhero` radio 20 px, `margin-bottom:12px` (632-634).
   - **Implementado:** `desk.css:204` overlay `rgba(22,24,29,.28)` sin animación; `.sheet` sin animación (205); `.sub` 600 (207); `.kv` `padding:10px 0` con `border-top` siempre (223) → aparece una línea extra justo bajo el `.dhero`; `.dhero` radio 16 px, `margin-bottom:8px` (226).
   - **Cómo corregir:** en `desk.css`: `.ov { background:rgba(17,17,17,.45); animation:fadeIn .18s ease-out }` `.sheet { animation:pop .2s cubic-bezier(.2,.8,.2,1) }` + keyframes `fadeIn`/`pop` del estático (66-68); `.sheet h3 { letter-spacing:-.01em; margin-bottom:6px }` `.sheet .sub { font-weight:500; line-height:1.4; margin:0 0 16px }` `.kv { padding:12px 2px }` `.dhero + .kv, .kv:first-of-type { border-top:0 }` `.dhero { border-radius:20px; margin-bottom:12px }`.

4. **MV-04** — **Severidad:** Media (base compartida)
   - **Estático:** validación por campo: `need()` (1004-1008) marca `.fl.bad` → borde `var(--err)` + anillo `0 0 0 3px var(--err-soft)` y texto `Completá este dato` bajo el input (`fld()` 999, CSS 619-621, 704-705); el error se limpia al tipear (1578).
   - **Implementado:** `DeskOverlays.tsx` lanza un único `Error` con mensaje global (`262-268`, `356`, `442`) que se muestra arriba del formulario (`.err`, `desk.css:233`). Ningún campo queda resaltado.
   - **Cómo corregir:** en `Field` aceptar `error?: string` y renderizar `<label className={`fl${error ? ' bad' : ''}`}>…<div className="ferr">{error}</div></label>`; en cada form mantener `const [bad, setBad] = useState<Record<string, boolean>>({})` y validar antes de `run()`. CSS: `.fl.bad input, .fl.bad select { border-color:var(--err); background:#fff; box-shadow:0 0 0 3px var(--err-soft) } .ferr { font-size:12px; font-weight:700; color:var(--err); margin-top:4px }`. Mantener el `.err` superior solo para errores del backend (regla 4 de AGENTS.md).

5. **MV-05** — **Severidad:** Alta
   - **Estático:** el segmentado de Estado en Registrar/Editar venta es `.sgs.stg` con punto de color por opción (`<i class="sd">`, 8 px, `margin-right:7px`, anillo blanco) y **un botón lápiz** `.sg-edit` al final (1746-1751, `I_PEN` 1742; CSS 847-851, 882-884): círculo 34 px, borde `1.5px dashed #C9CDD4`, ícono `#737984`; hover borde sólido `#16181D` y fondo `#F5FBD7`; `title`/`aria-label` = `Editar estados de venta`. Abre el submodal `Estados de venta` (`STK.ve` 1724: sistema = `Completada`, `Pendiente`; `Cancelada` borrable). Captura 14.
   - **Implementado:** `DeskOverlays.tsx:260-261` usa `Segs` sin lápiz (`ui.tsx:91-102`); los puntos de color existen pero sin `margin-right:7px` ni anillo (`desk.css:217`). No hay submodal.
   - **Cómo corregir:** ver **SJ-01** (mismo componente `StatusCatalogDialog` con `kind="sale"`). En `Segs` agregar prop `onEdit?: () => void` que renderiza `<button type="button" className="sg-edit" title="Editar estados de venta" aria-label="Editar estados de venta" onClick={onEdit}>{penSvg}</button>`; CSS de `.sg-edit` copiado de 850-851 + 884, y `.sg i { width:8px; height:8px; margin-right:7px; box-shadow:0 0 0 1.5px rgba(255,255,255,.7) }`, `.sgs.stg { gap:6px } .sgs.stg .sg { padding:0 11px }`. Persistencia: requiere el catálogo de estados del backend (ver SJ-01).

6. **MV-06** — **Severidad:** Alta
   - **Estático:** Registrar venta: `Cliente` es un `<select>` con primera opción **`Consumidor final`** (default) + clientes (1309); no hay alta de cliente inline.
   - **Implementado:** `DeskOverlays.tsx:228` default `clients[0]`; 245-250 la primera opción es `Nuevo cliente` (value `''`) que despliega Nombre + DNI (251-256) y crea un cliente al confirmar. No existe "Consumidor final".
   - **Cómo corregir:** necesita backend: `Sale.clientId` ya es nullable en Prisma (`schema.prisma:140`), pero `saleCreateSchema` exige `clientId: z.string().min(1)` (`backend/src/modules/sales/sales.routes.ts:24`) y el servicio actualiza `totalSpent` del cliente (`sales.service.ts:253`). Propuesta: `clientId: z.string().min(1).nullable().optional()` en create/patch, saltear la actualización del cliente cuando es `null`, y en el frontend `Sale.clientId: string | null`. En el select: `<option value="">Consumidor final</option>` como default; si se quiere mantener el alta inline, moverla a una opción final `+ Nuevo cliente…`. `clientName()` (`format.ts:126-128`) debe devolver `Consumidor final` cuando `clientId` está vacío (hoy devuelve `Sin cliente`).

7. **MV-07** — **Severidad:** Media
   - **Estático:** Registrar venta: label `<span>Equipo</span>` sobre la lista de `.pick` (1308); precio de cada pick con `fmtM` (`$ 1,3M`, captura 14); `Total` con placeholder `$ 0` (1311); separador de 6 px tras la lista.
   - **Implementado:** `DeskOverlays.tsx:239-244` lista sin label "Equipo"; precio con `formatMoney` (`$ 1.300.000`); `Total` sin placeholder (259). `.pick .r` sin peso 800 (`desk.css:232`), radio 14 px vs 16 px y 14 px de fuente no fijada (642-645).
   - **Cómo corregir:** insertar `<Field label="Equipo" />` antes de los picks; usar `formatMoneyCompact(item.price)`; `placeholder="$ 0"` en Total; CSS `.pick { border-radius:16px; font-size:14px } .pick .r { font-weight:800 }`.

8. **MV-08** — **Severidad:** Media
   - **Estático:** sin equipos disponibles: cuerpo `<div class="empty-d">No hay equipos disponibles. Cargá uno en Inventario.</div>` y **una sola** acción primaria `Entendido` (`.sacts.one`, 1312-1313).
   - **Implementado:** `DeskOverlays.tsx:239` muestra `.wempty` con `No hay equipos disponibles.` y sigue renderizando todo el formulario y `Cancelar` / `Confirmar venta`.
   - **Cómo corregir:** si `available.length === 0 && !current`, renderizar solo `<div className="empty-d">No hay equipos disponibles. Cargá uno en Inventario.</div><div className="sacts one"><button className="btn2 p" onClick={close}>Entendido</button></div>`; CSS `.empty-d { text-align:center; color:var(--secondary); font-size:13px; font-weight:600; padding:30px 10px }` (592).

9. **MV-09** — **Severidad:** Media
   - **Estático:** Editar venta: subtítulo `V-0001 · 05/10/2026` (`v.n + ' · ' + v.when`, 1277); campos `Cliente` (select con `Consumidor final`), `Equipo` (input texto, placeholder `Ej. iPhone 13 128GB`), `Forma de pago`, `Total` (placeholder `$ 0`), `Estado` (1278-1281). No tiene la lista de picks.
   - **Implementado:** `DeskOverlays.tsx:237` usa el mismo subtítulo que el alta (`Elegí el equipo y cómo pagó el cliente.`) y la misma lista de picks.
   - **Cómo corregir:** subtítulo `` current ? `${saleCode(current)} · ${formatShortDate(current.date)}` : 'Elegí el equipo y cómo pagó el cliente.' ``. Como el equipo es una relación real (`productId`), en edición es razonable reemplazar los picks por `<Field label="Equipo"><select>…</select></Field>` (equipo actual + disponibles) en lugar del input de texto libre del estático.

10. **MV-10** — **Severidad:** Media
    - **Estático:** detalle de venta no pendiente: acciones `Cerrar` / **`Compartir comprobante`** (toast `Link del comprobante copiado`, 1318, 1503).
    - **Implementado:** `DeskOverlays.tsx:307` `Cerrar` / `Editar`.
    - **Cómo corregir:** poner `Compartir comprobante` como primaria (la edición ya está en el menú contextual). Implementación mínima sin backend: armar un texto (`V-0001 · Cliente · Equipo · Total · Pago`) y usar `navigator.share` o `navigator.clipboard.writeText` + toast `Link del comprobante copiado` / `Comprobante copiado`. Un link público real necesita backend (endpoint firmado `GET /api/public/receipts/:token`).

11. **MV-11** — **Severidad:** Media
    - **Estático:** `ve-paid` (1501) además de pasar la venta a `Completada` **descuenta el total del saldo del cliente** (`c.saldo = max(0, c.saldo - x.total)`). Toasts: `V-0003 cobrada` / `V-0003 cancelada` (1501-1502).
    - **Implementado:** `DeskOverlays.tsx:302-305` solo actualiza `status`; no toca `pendingBalance`. Toasts genéricos `Venta cobrada` / `Venta cancelada`.
    - **Cómo corregir:** lo correcto es hacerlo en el backend dentro de la transacción de `updateSale` (`sales.service.ts`, bloque de update ~300-340): si `existing.status === 'PENDIENTE' && input.status === 'COMPLETADA' && clientId`, `pendingBalance = max(0, pendingBalance - amount)`. Toasts: `` `${saleCode(sale)} cobrada` `` y `` `${saleCode(sale)} cancelada` ``.

12. **MV-12** — **Severidad:** Media
    - **Estático:** `sell-eq` abre Registrar venta con el equipo preseleccionado (`setOverlay({type:'new-venta', eq:id})`, 1473; `pick = o.eq || …` 1307).
    - **Implementado:** `DeskOverlays.tsx:127-128` pasa `preset` solo si `'clientId' in overlay`. Desde el detalle de equipo se abre `{ type:'new-sale', productId }` (`DeskOverlays.tsx:155`), sin clave `clientId`, así que `preset` queda `undefined` y el equipo **no** se preselecciona (queda el primero disponible).
    - **Cómo corregir:** `preset={overlay.type === 'new-sale' ? { clientId: overlay.clientId, productId: overlay.productId } : undefined}`.

13. **MV-13** — **Severidad:** Baja
    - **Estático:** forma de pago con detalle de cuotas (`Tarjeta (3 cuotas)`, 948; edición conserva el sufijo si no cambia la base, 1276, 1534).
    - **Implementado:** `paymentLabel` (`format.ts:117-124`) solo mapea el enum; no hay cuotas.
    - **Cómo corregir:** opcional; `paymentMethod` es `VarChar(50)` libre, se podría guardar `TARJETA` + `customFields.installments` y mostrar `Tarjeta (N cuotas)`. Requiere decidir el modelo (no es bloqueante).

---

## Canjes

1. **CJ-01** — **Severidad:** Media
   - **Estático:** "en curso" = `Pendiente`, `Peritaje téc.`, `En revisión` (**no** incluye `Aprobado`) — `cjOpen()` 983; usado en el subtítulo (`5 canjes · 3 en curso`, 1676, captura 15) y en el badge del sidebar (1600).
   - **Implementado:** `TradeInsScreen.tsx:19` y `DeskApp.tsx:35` cuentan todo lo que no es `LISTO`/`RECHAZADO` (incluye `APROBADO`); `format.ts:163` `OPEN_TRADE_STATUSES` también incluye `APROBADO`.
   - **Cómo corregir:** `OPEN_TRADE_STATUSES = new Set(['PENDIENTE', 'PERITAJE TÉC.', 'EN REVISIÓN'])` y usar `isOpenTrade` en ambos lugares.

2. **CJ-02** — **Severidad:** Media
   - **Estático:** tarjeta del kanban = `cjCard()` (1024-1028) con estilos `.s-tickets .ticket` + `.dkanban` (175, 483, 547-556, 840-845): radio **20 px**, padding `14px 16px`, borde `1px solid var(--border)`, sombra `--sh`; cabecera `.wtop` con `flex-wrap:wrap; gap:6px` (en columnas angostas el pill baja a su propia línea, captura 15); `.date` 12 px/**500**; título `.store` 14 px/800 `margin-bottom:6px`; `.items` 12 px/500 `line-height:1.45`; monto `.wamt` **17 px/800** `letter-spacing:-.02em`, y debajo `small` `dif. $ …` 11 px/600 en bloque.
   - **Implementado:** `TradeInsScreen.tsx:63-77` + `desk.css:150-156`: radio 16 px, padding `12px 14px`, sin borde; `.meta` 12 px/700 en una línea con `justify-content:space-between` sin wrap (pill a la derecha); `.who` 600; `.amt b` sin tamaño propio → hereda el font-size por defecto de `<button>` (~13,3 px), muy por debajo de los 17 px; `dif.` inline a la derecha.
   - **Cómo corregir:** en `desk.css`:
     ```css
     .ticket { border-radius:20px; padding:14px 16px; border:1px solid var(--border); box-shadow:0 1px 2px rgba(0,0,0,.04),0 4px 14px rgba(0,0,0,.05); font-size:14px; }
     .ticket .meta { flex-wrap:wrap; gap:6px; font-weight:500; margin-bottom:4px; }
     .ticket .ttl { margin-bottom:6px; }
     .ticket .who { font-weight:500; line-height:1.45; margin:0 0 10px; }
     .ticket .amt { flex-wrap:wrap; gap:8px; }
     .ticket .amt b { font-size:17px; letter-spacing:-.02em; }
     .ticket .amt small { font-size:11px; display:block; }
     ```

3. **CJ-03** — **Severidad:** Media
   - **Estático:** fecha de la tarjeta `#C-0004 · 01/10/2026` (DD/MM/AAAA, 1025).
   - **Implementado:** `TradeInsScreen.tsx:73` imprime `item.date` (`TradeIn.dateLabel`, p. ej. `01 oct 2026`).
   - **Cómo corregir:** `formatShortDate(item.date)` (ver VE-02). Aplicar también en el subtítulo del detalle (MC-01).

4. **CJ-04** — **Severidad:** Media
   - **Estático:** cada canje tiene número fijo `C-0001…` asignado al crear (1509, 1250).
   - **Implementado:** `format.ts:140-148` `tradeCode()` calcula el número por posición ordenando por fecha; cambia si se borra un canje o se edita una fecha, y el mismo canje puede mostrar distinto código en distintos momentos (menú contextual, toasts, reportes).
   - **Cómo corregir:** necesita schema: agregar `tradeNumber Int @default(autoincrement())` a `TradeIn` (como `Sale.saleNumber`, `schema.prisma:138`), exponerlo en la respuesta (`trade-ins.service.ts` mapper ~187) y en `TradeIn` (`src/types.ts:46`), y `tradeCode = (t) => 'C-' + String(t.tradeNumber).padStart(4,'0')`.

5. **CJ-05** — **Severidad:** Baja
   - **Estático:** columnas `minmax(190px,1fr)` (1672); `.dcol` `min-height:240px`, sin `min-width` (803); `.dempty` `padding:22px 0` (807).
   - **Implementado:** `TradeInsScreen.tsx:56` `minmax(210px,1fr)`; `desk.css:147` `min-height:180px; min-width:210px`; `desk.css:157` `padding:28px 12px`.
   - **Cómo corregir:** igualar a 190 px / 240 px / `22px 0`; quitar `min-width`.

6. **CJ-06** — **Severidad:** Baja
   - **Estático:** sin hover en tarjetas del kanban (el hover de 780 solo aplica a `.dcard .ticket`); `:active { transform:scale(.98) }` (160) con `transition: transform .12s`.
   - **Implementado:** `desk.css:151` sombra en hover; sin `:active`.
   - **Cómo corregir:** `.dkanban .ticket:hover { box-shadow:… }` es aceptable en desktop; agregar `.ticket { transition:transform .12s } .ticket:active { transform:scale(.98) }`.

---

## Modales de canje

1. **MC-01** — **Severidad:** Media
   - **Estático:** detalle: título `C-0001 · Cliente`, subtítulo `05/10/2026 · Aprobado` (etiqueta legible del estado, 1330); además del `.dhero` y `Recibido` / `Valor tomado` / `Entrega`, hay una fila `Estado` con el pill (1332).
   - **Implementado:** `DeskOverlays.tsx:387` el subtítulo usa `trade.status` crudo (`LISTO`, `PERITAJE TÉC.`, `EN REVISIÓN`); `391-393` falta la fila `Estado`.
   - **Cómo corregir:** subtítulo `` `${formatShortDate(trade.date)} · ${statusLabel(trade.status)}` `` y agregar `<div className="kv"><span>Estado</span><b><Pill status={trade.status} /></b></div>`.

2. **MC-02** — **Severidad:** Media
   - **Estático:** acciones según estado (1325-1329): `Pendiente` → `Rechazar` / `Enviar a peritaje`; `Peritaje téc.` → `Rechazar` / `Pasar a revisión`; `En revisión` → `Rechazar` / `Aprobar canje`; `Aprobado` → **`Después`** / `Completar canje`; `Completado` y `Rechazado` → una sola `Cerrar` (`.sacts.one`). Al avanzar, el modal **queda abierto** con el nuevo estado y el toast es `C-0002 · En revisión` (1513); rechazar cierra con toast `C-0002 rechazado` (1514).
   - **Implementado:** `DeskOverlays.tsx:394-397`: siempre `Rechazar` / `Avanzar` mientras haya siguiente (incluido `Aprobado`); en `LISTO`/`RECHAZADO` `Editar` / `Cerrar`. `run()` (88-100) cierra el modal siempre; toasts `Canje actualizado` / `Canje rechazado`.
   - **Cómo corregir:**
     ```ts
     const NEXT_LABEL: Record<string, string> = { PENDIENTE: 'Enviar a peritaje', 'PERITAJE TÉC.': 'Pasar a revisión', 'EN REVISIÓN': 'Aprobar canje', APROBADO: 'Completar canje' };
     ```
     Secundario: `trade.status === 'APROBADO' ? 'Después' (cierra) : 'Rechazar'`. Si no hay siguiente: `<div className="sacts one"><button className="btn2 s">Cerrar</button></div>`. Para avanzar sin cerrar, agregar a `run` un flag `keepOpen` (o hacer el `updateTradeIn` directo con `setBusy`) y tostar `` `${tradeCode(...)} · ${statusLabel(next)}` ``.

3. **MC-03** — **Severidad:** Media
   - **Estático:** Editar canje: subtítulo `C-0001 · 05/10/2026` (1283); `Equipo que entregás` es input de texto (1284). Nuevo canje: subtítulo `El cliente entrega su equipo y se lleva uno del stock.`; `Equipo que entregás` es select con equipos disponibles **+ `A definir`** (1322).
   - **Implementado:** `DeskOverlays.tsx:327` mismo subtítulo para alta y edición; `336-348` select sin opción `A definir`.
   - **Cómo corregir:** subtítulo condicional `` current ? `${tradeCode(tradeIns, current.id)} · ${formatShortDate(current.date)}` : 'El cliente entrega su equipo y se lleva uno del stock.' ``; agregar `<option value="A definir">A definir</option>` al final del select (el backend acepta texto libre en `deviceGiven`, `VarChar(120)`).

4. **MC-04** — **Severidad:** Baja
   - **Estático:** placeholders `Ej. iPhone 11 64GB` (recibís), `$ 0` en `Valor tomado` y `Diferencia` (1321-1323); en edición `Ej. iPhone 13 128GB` en "entregás".
   - **Implementado:** `DeskOverlays.tsx:334` tiene el de recibís; `350-351` sin placeholder `$ 0`.
   - **Cómo corregir:** `placeholder="$ 0"` en ambos inputs de dinero.

5. **MC-05** — **Severidad:** Baja (desvío aceptable, documentar)
   - **Estático:** no pide IMEI del equipo recibido; obligatorios: `entrega` y `dif` en alta (1508), `entrega` y `recibe` en edición (1536).
   - **Implementado:** `DeskOverlays.tsx:335` agrega `IMEI recibido` y lo exige (356). El backend lo requiere (`TradeIn.deviceReceivedImei` no nullable, `schema.prisma:169`), así que el campo extra está justificado.
   - **Cómo corregir:** mantenerlo, pero ubicarlo en `frow` junto a "Equipo que recibís" para no alargar el modal, con placeholder `15 dígitos` (como el IMEI de equipo, 1272).

6. **MC-06** — **Severidad:** Alta
   - **Estático:** el segmentado `Estado` del alta/edición de canje tiene puntos de color + lápiz que abre `Estados de canje` (1286, 1323 → `sgs` con `CJ_ALL`, 1746-1751).
   - **Implementado:** `DeskOverlays.tsx:353-354` `Segs` sin lápiz.
   - **Cómo corregir:** `Segs` con `onEdit={() => openStatusCatalog('tradein')}` (ver SJ-01).

---

## Submodal estados de canje (captura 16)

1. **SJ-01** — **Severidad:** Alta (funcionalidad faltante completa)
   - **Estático:** `openSub/renderSub/saveSub` (1759-1816), CSS 853-885. Diálogo centrado sobre el modal (`#ovsub .ov` `z-index:120`, fondo `rgba(17,17,17,.32)`), `.dialog.stx` 460 px, `text-align:left`, `padding:22px 22px 18px`. Contenido:
     - Encabezado: `h3` **`Estados de canje`** 18 px + botón `×` (`.stx-x`, 32 px, círculo `#F0F1F3`, `aria-label="Cerrar"`).
     - Subtítulo: **`Tocá el color para cambiarlo. Si renombrás, se actualizan los canjes que lo usan.`** (1784), 13 px `#737984`.
     - Una fila por estado (`.stx-row`, `border-bottom:1px solid #F0F1F3`): swatch de color 26 px (borde blanco 3 px + anillo `#E6E8EC`; abierto: anillo `#16181D`), input del nombre (`maxlength=20`, `placeholder="Nombre"`, 38 px, radio 10 px), contador `N canje` / `N canjes` (o `nuevo`), y a la derecha **candado** (`I_LOCK`, `#C3C7CE`, `title="Lo usa el sistema: se puede renombrar y cambiar de color, no borrar"`) para los de sistema `Pendiente`, `Completado`, `Rechazado` (1725), o **papelera** (`I_TRASH`, hover fondo `#FDECEC` y color `#DC4C4C`) para el resto.
     - Clic en swatch: paleta de 10 colores `ST_PAL` (1721: Verde `#25A66A`, Turquesa `#0F9D8A`, Azul `#3B82F6`, Violeta `#8B5CF6`, Rosa `#EC4899`, Rojo `#DC4C4C`, Ámbar `#E8A33D`, Lima `#9DB51F`, Gris `#737984`, Carbón `#16181D`) en `.stx-pal` (botones 24 px, `padding-left:36px`).
     - Borrar: la fila queda tachada (`.stx-row.del`), aparece `Deshacer` (`.stx-undo`) y, si hay registros, un aviso ámbar `.stx-re` (`#FFF6E5`): **`N canjes tienen este estado. Pasarlos a [select]`**; si no hay registros: **`Se elimina al guardar.`** (`.stx-re.soft`).
     - Botón **`+ Agregar estado`** (`.stx-add`, 40 px, borde `1.5px dashed #C9CDD4`, hover borde `#16181D` + fondo `#F5FBD7`); el nuevo toma el primer color libre de la paleta y recibe foco.
     - Errores (`.stx-err`, `#DC4C4C`): `Tiene que quedar al menos uno.`, `Hay uno sin nombre.`, `«X» está repetido.` (resalta la fila con borde rojo en el input).
     - Pie: `Cancelar` / `Guardar` (pastillas del `.dialog`).
     - Guardar: renombra en todos los registros, reasigna los borrados, recalcula el flujo (`CJ_FLOW` = todos menos `Rechazado`) y los chips de filtro, re-renderiza el segmentado abierto conservando la selección, y tuesta `Cambios guardados · 1 nuevo, 1 renombrado, 1 eliminado` (1815).
     - `Escape` cierra **solo** el submodal (listener en captura con `stopPropagation`, 1837); clic en el fondo también.
   - **Implementado:** no existe. Los estados están hardcodeados en `DeskOverlays.tsx:51-58` (`CJ_STATUS`), `TradeInsScreen.tsx:6-12` (`COLUMNS`) y `format.ts:62-101` (labels y colores).
   - **Cómo corregir (frontend):** nuevo componente `src/desk/StatusCatalogDialog.tsx` con `kind: 'sale' | 'tradein' | 'inventory' | 'clientTag'`, que reproduzca la estructura y clases `stx-*` del estático (copiar CSS 853-885 a `desk.css`). Montarlo en un root propio por encima del `Sheet` (`z-index:120`). En `Sheet`, ignorar `Escape` si el submodal está abierto (o registrar el listener del submodal en captura con `stopPropagation`, como el estático). Exponer en `useDesk()` `openStatusCatalog(kind)`. Pantallas y formularios deben leer labels, colores y orden del catálogo (reemplazar `COLUMNS`, `CJ_STATUS`, `SALE_STATUS`, `STATUS_LABEL`, `STATUS_COLOR`).
   - **Cómo corregir (backend/schema, requerido para persistir):**
     ```prisma
     model StatusOption {
       id        String   @id @default(cuid())
       storeId   String
       kind      String   @db.VarChar(20)   // "sale" | "tradein" | "inventory" | "clientTag"
       key       String   @db.VarChar(30)   // valor guardado en Sale.status / TradeIn.status (estable)
       label     String   @db.VarChar(20)
       color     String   @db.VarChar(9)
       sortOrder Int      @default(0)
       isSystem  Boolean  @default(false)
       store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
       @@unique([storeId, kind, key])
       @@index([storeId, kind])
     }
     ```
     Endpoints: `GET /api/status-options?kind=tradein` (devuelve los de sistema por defecto si la tienda no tiene filas: `PENDIENTE`, `PERITAJE TÉC.`, `EN REVISIÓN`, `APROBADO`, `LISTO`→"Completado", `RECHAZADO`) y `PUT /api/status-options/:kind` con `{ options: [{ key?, label, color }], reassign: { [deletedKey]: targetKey } }`, que en una transacción hace upsert, `updateMany` de los registros reasignados y rechaza borrar `isSystem`. Como el registro guarda `key` y no `label`, renombrar no requiere actualizar registros. Las validaciones de flujo del backend deben seguir usando las keys de sistema (`VALID_TRADE_IN_STATUSES`, `trade-ins.service.ts:88-95`, hoy solo usada en import) y aceptar keys custom de la tienda.

2. **SJ-02** — **Severidad:** Media
   - **Estático:** al guardar el catálogo, el kanban (`cjList`, 1671) usa el `CJ_FLOW` actualizado: un estado nuevo agrega una columna y los chips (`CJ_ST`) se regeneran (1807).
   - **Implementado:** columnas fijas en `TradeInsScreen.tsx:6-12` y chips derivados de ellas (51).
   - **Cómo corregir:** derivar `COLUMNS` del catálogo (`options.filter(o => o.key !== 'RECHAZADO')`) y los chips de `['Todos', ...options]`.

---

## Clientes

1. **CL-01** — **Severidad:** Alta
   - **Estático:** en la columna Cliente, el nombre lleva al lado el **pill de etiqueta** (`c.tag ? ' ' + pill(c.tag)`, 1685; captura 17: `Frecuente` violeta, `Mayorista` azul), con colores `STC.cl` (1734: Frecuente `#8B5CF6`, Mayorista `#3B82F6`, Nuevo `#E8A33D`) vía `.spill.cst`.
   - **Implementado:** `ClientsScreen.tsx:59` solo nombre + email. No hay concepto de etiqueta.
   - **Cómo corregir:** ver ET-01 (persistencia). Render: `<b>{client.name}{tag ? <> <Pill status={tag.label} color={tag.color} /></> : null}</b>` (extender `Pill` con `color?: string`).

2. **CL-02** — **Severidad:** Media
   - **Estático:** pill de saldo `Saldo $ 1,1M` con `.spill.off` = **fondo `#16181D`, texto blanco** (572; captura 17).
   - **Implementado:** `desk.css:139` `.spill.off { background:#FDECEC; color:#9A3030 }` (rojo claro).
   - **Cómo corregir:** `.spill.off { background:#16181D; color:#fff }`.

3. **CL-03** — **Severidad:** Media
   - **Estático:** colores de avatar `.av-c.b` `--c-blue #5B8DEF`, `.p` `--c-pink #DF668B`, `.g` `--c-green #397964` (468, 538); en `.dcell` 36 px, 13 px (794).
   - **Implementado:** `desk.css:159-163`: `.p` `#F85582`, `.g` `#25A66A`, `.a` `#8B5CF6` (tono extra que no existe en el estático); 12 px. `avatarTone` (`format.ts:156-161`) reparte entre 4 tonos.
   - **Cómo corregir:** `.av-c.p { background:#DF668B } .av-c.g { background:#397964 }`, eliminar `.a` (o mapear a `.l` lima `#DDF43B` con texto `#16181D`, 538) y `tones = ['b','p','g']`; `.dcell .av-c { font-size:13px }`.

4. **CL-04** — **Severidad:** Baja
   - **Estático:** `Última compra` `DD/MM` (`05/10`, 1685; datos 959-962); sin email el `small` muestra `—` (el alta guarda `'—'`, 1522).
   - **Implementado:** `ClientsScreen.tsx:64` muestra `lastPurchaseDate` del backend (`toLocaleDateString('es-AR')` → `5/10/2026`, `clients.service.ts:90-93`); `ClientsScreen.tsx:59` muestra `Sin email`.
   - **Cómo corregir:** `const d = parseAppDate(client.lastPurchaseDate); d ? d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' }) : '—'` y `client.email || '—'`.

5. **CL-05** — **Severidad:** Baja
   - **Estático:** buscador filtra por nombre, teléfono y DNI (1682).
   - **Implementado:** `ClientsScreen.tsx:17` también por email.
   - **Cómo corregir:** opcional; es una mejora. Si se mantiene, no requiere cambio de placeholder.

---

## Modales de cliente

1. **MK-01** — **Severidad:** Alta
   - **Estático:** detalle de cliente con saldo: acciones **`Registrar pago`** (secundaria) / `Nueva venta` (primaria); sin saldo: `Cerrar` / `Nueva venta` (1336). `cl-paid` pone el saldo en 0 y tuesta `Pago registrado` (1542).
   - **Implementado:** `DeskOverlays.tsx:413-416` siempre `Cerrar` / `Nueva venta`; no hay forma de registrar un pago desde el detalle.
   - **Cómo corregir:** versión mínima con el campo real `Client.pendingBalance`: si `client.pendingBalance > 0`, secundaria `Registrar pago` → `updateClient({ ...client, pendingBalance: 0 })`, toast `Pago registrado`, con estado `busy`/error visible (no cerrar si falla). Versión completa (recomendada, para pagos parciales e historial): modelo `ClientPayment { id, storeId, clientId, amount Decimal(12,2), method VarChar(50), paidAt DateTime, note String? }` + `POST /api/clients/:id/payments { amount, method }` que en una transacción crea el pago y decrementa `pendingBalance` (sin bajar de 0); en el UI, un mini-formulario con `Monto` (default = saldo) y `Forma de pago`.

2. **MK-02** — **Severidad:** Baja
   - **Estático:** subtítulo del detalle `Última compra 05/10 · DNI 30.111.222` (o `Sin compras todavía`), y solo filas `Teléfono` y `Email` (1334-1335).
   - **Implementado:** `DeskOverlays.tsx:408` subtítulo sin DNI; fila extra `DNI` (412).
   - **Cómo corregir:** subtítulo `` `Última compra ${dd/mm} · DNI ${client.dni}` `` y quitar la fila DNI.

3. **MK-03** — **Severidad:** Media
   - **Estático:** **Nuevo cliente** (1338): sin subtítulo; campos `Nombre y apellido` (placeholder `Ej. Cliente Ejemplo`), `Teléfono` (`+54 11 …`, `type="tel"`), `Email` (`opcional`, `type="email"`), `Etiqueta` (segmentado + lápiz); obligatorios: nombre y teléfono (1520). No pide DNI ni saldo. Acción `Guardar cliente`. Captura 18.
     **Editar cliente** (1289-1291): `Nombre y apellido`, `frow` `DNI` (`30.000.000`, `inputmode=numeric`) / `Teléfono`, `Email`, `Saldo pendiente` (`$ 0`), `Etiqueta`; obligatorio solo nombre.
   - **Implementado:** `DeskOverlays.tsx:432-440`: el alta y la edición usan el mismo formulario (con DNI y Saldo pendiente también en el alta), sin placeholders ni `type`, sin Etiqueta; obligatorios nombre y DNI (442).
   - **Cómo corregir:** el DNI es requerido por el backend (`Client.dni` no nullable + `@@unique([storeId, dni])`, `schema.prisma:66, 82`), así que debe quedarse en el alta: poner `frow` `DNI` / `Teléfono` también en el alta (desvío justificado) y quitar `Saldo pendiente` del alta. Agregar placeholders (`Ej. Cliente Ejemplo`, `30.000.000`, `+54 11 …`, `opcional`, `$ 0`), `type="tel"`, `type="email"`, `inputMode="numeric"` en DNI. Agregar `Etiqueta` (ET-01).

---

## Submodal etiquetas (captura 18)

1. **ET-01** — **Severidad:** Alta (funcionalidad faltante)
   - **Estático:** segmentado `Etiqueta` con `CL_TAG` = `Frecuente`, `Mayorista`, `Nuevo` (1233), cada uno con punto de color (`STC.cl`, 1734), ninguno seleccionado por defecto en el alta, y lápiz `title="Editar etiquetas de cliente"` (1750). El submodal usa `STK.cl` (1726): título **`Etiquetas de cliente`**, botón **`+ Agregar etiqueta`**, **todas borrables** (`sys: []`, sin candados), contador `N cliente` / `N clientes`, subtítulo **`Tocá el color para cambiarlo. Si renombrás, se actualizan los clientes que la usan.`** (1784, con `la` por `w: 'esta etiqueta'`), aviso de reasignación **`N clientes tienen esta etiqueta. Pasarlos a [select]`** (1777). Toast de guardado `Cambios guardados · 1 nuevo, 1 renombrado, 1 eliminado` (captura 18).
   - **Implementado:** no existe ni el campo ni el submodal.
   - **Cómo corregir:** dos opciones de persistencia:
     - (a) Reusar `ClientCategory` (`schema.prisma:85-96`), que ya tiene CRUD en el frontend (`AppContext.tsx:59-62, 733-748`: `createClientCategory`, `renameClientCategory`, `deleteClientCategory`, `bulkMoveClientCategory`), agregando `color String @default("#737984") @db.VarChar(9)`, y usar `Client.categoryId` como etiqueta. Riesgo: hoy `ClientCategory` se usa como "pestañas/categorías" en la página legacy `src/pages/Clients.tsx`; habría que confirmar que ese uso sea el mismo concepto.
     - (b) Usar `StatusOption` con `kind = 'clientTag'` (SJ-01) y un campo nuevo `Client.tag String? @db.VarChar(30)`.
     En ambos casos: `StatusCatalogDialog kind="clientTag"` con `allowNone` (una etiqueta puede quedar vacía; el estático no permite des-seleccionar, conviene permitir clic en la seleccionada para quitarla) y sin filas de sistema.

---

## Reportes (captura 19)

1. **RP-01** — **Severidad:** Alta
   - **Estático:** `Mes` = **5 barras semanales** con labels de fecha de inicio (`10 sep`, `16 sep`, `22 sep`, `28 sep`, `5 oct`) y subtítulo `por semana`; `Semana` = 7 barras `L M M J V S D` `por día`; `3 meses` = `Ago Sep Oct` `por mes`; `Año` = 12 meses con iniciales `N D E F M A M J J A S O` `por mes` (1174, 1204). Aplica igual a los tres tabs.
   - **Implementado:** `ReportsScreen.tsx:192` `makeBuckets('Mes')` arma **4 buckets mensuales** (labels `jul ago sep oct`), pero el subtítulo dice `por semana` (146) → inconsistente. En Canjes, `Mes` dice `por mes` (173). `Semana` usa `weekday:'narrow'` móvil terminando hoy (`ReportsScreen.tsx:188`; en es-AR el miércoles sale `X`, no `M`). `Año` usa `month:'short'` (`ene`, `feb`…) en lugar de iniciales.
   - **Cómo corregir:** en `makeBuckets`: para `Mes`, 5 buckets de 6-7 días que cubran los últimos 30 días, label = fecha de inicio `toLocaleDateString('es-AR',{day:'numeric',month:'short'}).replace('.','')`; para `Año`, label = inicial del mes en mayúscula (`'EFMAMJJASOND'[month]`); para `3 meses`, mes con mayúscula inicial (`Ago`); para `Semana`, iniciales `['D','L','M','M','J','V','S'][day]`. Unificar `bucketLabel` para los tres tabs: `{ Semana:'por día', Mes:'por semana', '3 meses':'por mes', Año:'por mes' }`. Usar `key={index}` en las barras (los labels de días se repiten).

2. **RP-02** — **Severidad:** Alta
   - **Estático:** la barra seleccionada (por defecto la última) muestra un **tooltip** `.gtip` encima: `<b>$ 2,15M</b> · en curso` (última barra) o `<b>valor</b> · label` (resto); valor en lima `#DDF43B` 800, fondo `#16181D`, 11 px/600, radio 10 px, sombra; se alinea a la izquierda en las 2 primeras (`.tl`) y a la derecha en las 2 últimas (`.tr`) (1202, CSS 381-384, 680). Clic en una barra la selecciona (`r-bar`, 1551).
   - **Implementado:** `ReportsScreen.tsx:57-63` la selección existe (cambia color) pero **no hay tooltip**.
   - **Cómo corregir:**
     ```tsx
     {index === active && (
       <span className={`gtip${index < 2 ? ' tl' : index > n - 3 ? ' tr' : ''}`} style={{ bottom: h + 8 }}>
         <b>{model.money ? formatMoneyCompact(bucket.value) : bucket.value}</b>{index === n - 1 ? ' · en curso' : ` · ${bucket.label}`}
       </span>
     )}
     ```
     CSS: `.gtip { position:absolute; left:50%; transform:translateX(-50%); background:#16181D; color:#fff; font-size:11px; font-weight:600; padding:5px 9px; border-radius:10px; white-space:nowrap; z-index:3; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,.2) } .gtip b { color:var(--lime); font-weight:800 } .gtip.tl { left:0; transform:none } .gtip.tr { left:auto; right:0; transform:none }`.

3. **RP-03** — **Severidad:** Alta
   - **Estático:** el donut es **interactivo** (`r-cat`, 1552): clic en un segmento o en una fila de la leyenda filtra; el seleccionado engrosa (`stroke-width` 24 vs 20), los demás se pintan `#E7E7E7`; en la leyenda la fila activa toma fondo `.glg.sel` (`--row`) y las otras `.glg.off` (color `#9AA0AA`, swatch blanco); el centro pasa a mostrar `%` y el nombre de la categoría (1210-1211); clic de nuevo des-selecciona. En Stock y Canjes la lista de abajo se filtra por la categoría (1217-1218). Cambiar de tab resetea el filtro (1549). Encabezado del card: **`tocá para filtrar`** (1214).
   - **Implementado:** `ReportsScreen.tsx:98-125` donut estático, sin estado de categoría; encabezado `datos reales` (70); centro siempre `total`; la lista no se filtra.
   - **Cómo corregir:** `const [cat, setCat] = useState<string | null>(null)` (resetear en cambio de tab); pasar `cat`/`onToggle` a `Donut`; segmentos `<circle className="gseg" onClick={() => toggle(part.label)} stroke={!cat || cat === part.label ? part.color : '#E7E7E7'} strokeWidth={cat && cat === part.label ? 24 : 20} />`; leyenda como `<button className={`glg${cat === l ? ' sel' : cat ? ' off' : ''}`}>`; centro `cat ? `${Math.round(v/sum*100)}%` + small label : total`; filtrar listas de Stock/Canjes por `statusLabel(item.status) === cat`. Texto del header: `tocá para filtrar`.

4. **RP-04** — **Severidad:** Media
   - **Estático:** donut 132×132, radio 46, `stroke-width:20`, separación de 1,6 entre segmentos (`L - 1.6`, 1209); sin datos: anillo punteado `#E7E7E7` `stroke-dasharray="5 5"`, centro `—` / `sin datos` (1207, 1211). Colores por tab (1177-1180): Ventas `--c-green #397964`, `--c-blue #5B8DEF`, `--c-pink #DF668B`, `--c-lime #DDF43B`; Stock fijo `Disponible` lima, `En revisión` azul, `Vendido` verde, `Reservado` rosa (incluye los que tienen 0); Canjes fijo `Pendiente` azul, `Peritaje téc.` rosa, `En revisión` lima, `Aprobado` verde, `Completado` `#16181D` (sin `Rechazado`). Leyenda: swatch **cuadrado** 11 px radio 4 px con borde `rgba(4,50,32,.25)`, `padding:5px 6px`, 13 px/600, `b` 800 (398-401).
   - **Implementado:** `ReportsScreen.tsx:106-111` 148 px, `strokeWidth 18`, gap 2; sin estado vacío (con `sum || 1` el anillo queda en blanco y el centro dice `0` / `total`); colores `#25A66A, #3B82F6, #F85582, #DDF43B, #8B5CF6` (149), otros sets en 153 y 176; categorías dinámicas (solo las presentes, orden de aparición). `desk.css:199` swatch circular 10 px.
   - **Cómo corregir:** usar 132 px y 20 de grosor, `Math.max(0, L - 1.6)`; si `sum === 0` dibujar el anillo punteado y centro `—`/`sin datos`. Definir categorías fijas por tab con los colores del estático (`--c-*` en `desk.css`: `--c-green:#397964; --c-blue:#5B8DEF; --c-pink:#DF668B; --c-lime:#DDF43B`) y completar con 0 las ausentes; estados extra (p. ej. `RECHAZADO` o custom) al final en gris. `.glg i { width:11px; height:11px; border-radius:4px; border:1px solid rgba(4,50,32,.25) }`.

5. **RP-05** — **Severidad:** Media
   - **Estático:** tab Stock: eyebrow **`Equipos ingresados`**, total = ingresos del período, delta `3 en stock · 2 disponibles`; las barras son la **evolución temporal de ingresos** con los mismos buckets que los otros tabs (1185, 1188).
   - **Implementado:** `ReportsScreen.tsx:152-163`: eyebrow `Equipos en stock`, total = inventario actual, delta `N disponibles`, barras = conteo por estado (labels `Dis`, `En `, …) con subtítulo `snapshot actual`.
   - **Cómo corregir:** necesita la fecha de ingreso: `InventoryItem.createdAt` existe en Prisma (`schema.prisma:129`) pero no se expone en `Product` (`src/types.ts:1-16`). Exponer `createdAt` en la respuesta de inventario y en el tipo, y usar `addToBucket(buckets, item.createdAt, 1)`. Alternativa sin tocar inventario: consumir `fetchReportsOverview` (`src/services/reports-api.ts:28`), que ya devuelve `inventory.series` y `tradeIns.series` (`src/types/reports.ts:75-103`). Delta: `` `${inventory.length} en stock · ${disponibles} disponibles` ``.

6. **RP-06** — **Severidad:** Media
   - **Estático:** tab Canjes: delta = **`N en curso`** (`cjOpen()`, 1186). Ventas: `▲ 12% vs período anterior`.
   - **Implementado:** `ReportsScreen.tsx:172` Canjes usa `deltaLabel` (variación vs período anterior o `sin base anterior` / `sin movimiento`).
   - **Cómo corregir:** Canjes: `` `${tradeIns.filter(t => isOpenTrade(t.status)).length} en curso` `` (con la definición corregida de CJ-01).

7. **RP-07** — **Severidad:** Media
   - **Estático:** encabezado `.topbar`: `h1 Reportes` + botón circular `.circ` 40 px (`border:1px solid var(--border)`, fondo blanco) con ícono de descarga `I.dl()` (1219, CSS 98, 668; captura 19). Toast `Reporte de ventas exportado en PDF` (con el tab en minúscula, 1553).
   - **Implementado:** `ReportsScreen.tsx:44` botón de texto `Descargar` (`dbtn s`) y toast `El PDF se arma desde los datos de esta pantalla. Exportación de archivo sigue en la versión de escritorio.`
   - **Cómo corregir:** `<button className="circ" aria-label="Exportar" onClick={…}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16181D" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg></button>`; CSS `.circ { width:40px; height:40px; border-radius:50%; border:1px solid var(--border); background:#fff; display:flex; align-items:center; justify-content:center }`. Toast `` `Reporte de ${tab.toLowerCase()} exportado en PDF` `` solo si realmente se exporta; si no, implementar exportación (p. ej. `window.print()` con hoja de estilos de impresión o CSV) antes de anunciarla.

8. **RP-08** — **Severidad:** Media
   - **Estático:** filtros `.gfilters` en una sola fila alineada a la izquierda (`display:flex; gap:16px`, 816): tabs `.gchip` 38 px (`padding:0 12px`, 13 px/700, borde `#E6E8EC`, activo `#16181D`) y períodos `.gchip.sm` 32 px / 12 px (activo `--lime-soft` con borde `#E3EDB0`) (360-362, 671-673, 699).
   - **Implementado:** `desk.css:176` `justify-content:space-between` → los períodos quedan pegados a la derecha; `.gchip` 36 px / 800 (177); `.sm` no cambia tamaño (solo color en 179).
   - **Cómo corregir:** `.gfilters { justify-content:flex-start; gap:16px; margin-bottom:16px }` `.gchip { height:38px; padding:0 12px; font-weight:700 }` `.gchip.sm { height:32px; font-size:12px }`; contenedores con `display:flex; gap:8px` (en vez de `margin-right` en cada chip).

9. **RP-09** — **Severidad:** Media
   - **Estático:** total: eyebrow `.geye` en **mayúsculas** 11 px/700 `letter-spacing:.06em` color `#9AA0AA` (`FACTURACIÓN · ÚLTIMOS 30 DÍAS`); `.gamount` **36 px** (675); `.gdelta` 12 px/700 `padding:5px 11px` (367).
   - **Implementado:** `desk.css:181-183` `.geye` 13 px sin uppercase, color secundario; `.gamount` 40 px; `.gdelta` 13 px/800 `4px 10px`.
   - **Cómo corregir:** `.geye { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:#9AA0AA }` `.gamount { font-size:36px; line-height:1.15; margin:2px 0 8px }` `.gdelta { font-size:12px; font-weight:700; padding:5px 11px }`.

10. **RP-10** — **Severidad:** Media
    - **Estático:** gráfico de barras: área 120 px (`.gbars`, `margin-top:34px`, `border-bottom:1.5px solid var(--border)`, línea guía punteada a 24 px del tope con `::before`), altura de barra `max(3, v/max*96)` px, barras con `max-width:46px` y radio `8px 8px 0 0`, `gap:6px`; labels `.gxl` 10 px/600, seleccionado 800 (375-390). Card `.gcard` radio 24 px, `padding:16px`, borde + sombra `--sh` (371, 483); header `.ghd` h3 16 px/800, subtítulo 11 px/500 (372-374).
    - **Implementado:** `desk.css:185-191` área 220 px sin borde inferior ni guía, barras hasta 180 px a ancho completo (sin `max-width`) con radio `8px 8px 4px 4px`, `gap:10px`; labels 11 px/700. Usa `.dcard`/`.dch`/`.mut` (radio 20 px, subtítulo 13 px/600).
    - **Cómo corregir:** copiar las reglas `.gbars`, `.gbars::before`, `.gcol`, `.gcol i`, `.gxl` del estático (375-390) y escala 96 px en `ReportsScreen.tsx:61`; usar clases `gcard`/`ghd` en lugar de `dcard`/`dch` para los dos cards del gráfico.

11. **RP-11** — **Severidad:** Media
    - **Estático:** lista inferior: encabezado `.glh` fuera de cards (h3 17 px/800 + span 12 px/600): **`Ventas del período`** / `N recientes`, **`Equipos`** / `N en stock`, **`Canjes`** / `N en total` (1216-1218). Cada ítem es una **tarjeta propia** `.gtk` (fondo blanco, radio 20 px, `padding:13px 14px 13px 16px`, `margin-bottom:10px`, borde + sombra) con `.gdate` 11 px/600, `.gstore` 15 px/800, `.gmeta` 12 px + pill, a la derecha `.gamt` 17 px/800 y chevron `›` (`.gchev`, 22 px `#9AA0AA`) (407-417). En Stock la fecha es `IMEI …1234` (con `…`); en Canjes el monto lleva `+` (`+$ 300.000`).
    - **Implementado:** `ReportsScreen.tsx:74-92`: un único `.dcard.glist` con filas separadas por `border-top` (`desk.css:201-202`), **sin encabezado**, sin chevron, con clases `mut`; Stock `IMEI 1234` (sin `…`); Canjes sin `+`.
    - **Cómo corregir:** renderizar `<div className="glh"><h3>Ventas del período</h3><span>{n} recientes</span></div>` (y equivalentes) y cada fila como `<button className="gtk"><div className="gl"><div className="gdate">…</div><div className="gstore">…</div><div className="gmeta">… <Pill/></div></div><div className="gr"><div className="gamt">…</div><span className="gchev">›</span></div></button>` con el CSS de 404-417; `IMEI …{imei.slice(-4)}` y `+{formatMoneyCompact(differencePaid)}`.

12. **RP-12** — **Severidad:** Baja
    - **Estático:** grilla `1.6fr 1fr`, `gap:18px` (817); `.dm .topbar` `padding:0 0 18px` (810).
    - **Implementado:** `desk.css:184` `1.5fr 1fr`; título dentro de `.dtop` (`margin-bottom:22px`).
    - **Cómo corregir:** `.repgrid { grid-template-columns:1.6fr 1fr }` y `margin-bottom:18px` en el encabezado.

---

## Menús contextuales

1. **MX-01** — **Severidad:** Media
   - **Estático:** menú `.popmenu.ctxm` (1262-1264, CSS 92-96, 479-480, 717-723, 827-828): ancho 220 px, radio 18 px, `padding:6px`, sombra `0 14px 40px rgba(0,0,0,.18)` + borde; ítems con **íconos SVG** `I.edit()` (lápiz) en `Editar` y `I.trash()` (tacho) en `Eliminar` (910-912), `padding:13px 12px`, 14 px/700, separados con `border-top:1px solid var(--border)`; `Eliminar` en `var(--err)`. Overlay con leve oscurecimiento `rgba(22,24,29,.08)` y animación `pop .16s`.
   - **Implementado:** `DeskOverlays.tsx:68-80` + `desk.css:234-238`: sin íconos, 210 px, radio 16 px, ítems `padding:11px 10px` sin separador, hover gris (el estático no tiene hover), overlay transparente, sin animación.
   - **Cómo corregir:** agregar los SVG (`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>` y `<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>`); CSS `.ctx { width:220px; border-radius:18px; animation:pop .16s ease-out } .ctx button { padding:13px 12px; gap:10px } .ctx button + button { border-top:1px solid var(--border) }`; overlay `background:rgba(22,24,29,.08)`.

2. **MX-02** — **Severidad:** Baja
   - **Estático:** posición (`lpOpen` desktop, 1710-1717): vertical **debajo de la fila** (`r.bottom + 4`) o encima si no entra (`r.top - 150`); horizontal `min(innerWidth - 236, max(12, clickX - 20))`.
   - **Implementado:** `DeskOverlays.tsx:73` `top = min(clickY, innerHeight - 150)`, `left = min(clickX, innerWidth - 230)` (se abre en el punto del clic, tapando la fila).
   - **Cómo corregir:** guardar en el overlay el `getBoundingClientRect()` de la fila (`event.currentTarget`) y calcular `top = r.bottom + 160 < innerHeight ? r.bottom + 4 : max(12, r.top - 150)`, `left = min(innerWidth - 236, max(12, clientX - 20))`.

3. **MX-03** — **Severidad:** Media
   - **Estático:** confirmación de borrado = `dialog()` centrado (1009-1011, 1265-1266; CSS 85-91): 340 px, radio 26 px, centrado; título **`¿Eliminar esta venta?`** / **`¿Eliminar este canje?`** / **`¿Eliminar este cliente?`** (`CTX.what`, 1239-1241); texto **`V-0001 · Cliente Ejemplo A se va a borrar y no se puede deshacer.`**; botones pastilla `Cancelar` / `Eliminar` (rojo `var(--err)`, 706). Toast específico: `Venta eliminada` / `Canje eliminado` / `Cliente eliminado` (1239-1241, 1526).
   - **Implementado:** `DeskOverlays.tsx:110-122` usa `Sheet` de 540 px alineado a la izquierda, título genérico `¿Eliminar?`, texto `… se borra y no se puede deshacer.`, toast `Eliminado`.
   - **Cómo corregir:** crear `Dialog` en `ui.tsx` (`.dialog` 340 px, `text-align:center`, radio 26 px, `padding:24px 20px 18px`, `.row` grid 2 columnas con botones 48 px pastilla) y usarlo con `title={`¿Eliminar ${WHAT[kind]}?`}` (`{ sale:'esta venta', cj:'este canje', cl:'este cliente', eq:'este equipo' }`), texto `` `${label} se va a borrar y no se puede deshacer.` `` y toast `DONE[kind]`. El `.err` de backend se muestra dentro del diálogo si falla (no cerrar).

4. **MX-04** — **Severidad:** Baja
   - **Estático:** además del clic derecho, mantener apretado 480 ms abre el menú (1426-1430), con feedback `.holding` (fila `--lime-soft`, 789; tarjeta `scale(.98)`, 714) y `.pressed` (715-716).
   - **Implementado:** solo `onContextMenu` (`SalesScreen.tsx:86-89`, `TradeInsScreen.tsx:68-71`, `ClientsScreen.tsx:51-54`).
   - **Cómo corregir:** opcional en desktop (útil en pantallas táctiles): hook `useLongPress(onOpen, 480)` con `pointerdown/move/up` (cancelar si mueve más de 8 px) que agrega `holding`; CSS `.dtable tbody tr.holding { background:var(--lime-soft) }`.

---

## Cosas que ya coinciden

- **Ventas:** título `Ventas`, subtítulos `Esta semana` / `Este mes` / `Este año`, placeholder `Buscar cliente, equipo o número`, orden del header (buscar, período, Importar, Registrar venta), las 4 tarjetas KPI con sus eyebrows `Facturación total` / `Ticket promedio` / `Variación` + `vs período anterior`, pill lima `N ventas`, columnas `Venta · Fecha · Cliente · Equipo · Pago · Total · Estado` con `#V-0001` en negrita y total alineado a la derecha, título de card `Ventas del período` + `N de M`, vacío `No encontré ventas.`, colores de estado de venta (`#25A66A` / `#E8A33D` / `#DC4C4C`).
- **Detalle de venta:** título `V-0001`, `.dhero` `Total`, filas `Cliente / Equipo / Pago / Estado`, acciones `Cancelar venta` / `Marcar cobrada` en pendientes.
- **Registrar venta:** título, subtítulo `Elegí el equipo y cómo pagó el cliente.`, picks con `modelo · capacidad` + `color · IMEI …1234`, `Forma de pago` `Transferencia / Efectivo / Tarjeta / Cripto` con default Transferencia, total precargado con el precio, `Confirmar venta` / `Guardar cambios`.
- **Canjes:** título, subtítulo `N canjes · M en curso` (salvo la definición de "en curso"), placeholder `Buscar cliente o equipo`, `Nuevo canje`, chips `Todos · Pendiente · Peritaje téc. · En revisión · Aprobado · Completado · Rechazado`, kanban con 5 columnas en `Todos` (sin Rechazado) y una sola columna al filtrar, contador por columna en burbuja blanca, `Sin canjes`, contenido de tarjeta (`Recibido:` / cliente / `Entrega:` / valor tomado / `dif.`), colores de estados de canje.
- **Detalle de canje:** barra de pasos de 5 segmentos lima, `Diferencia a cobrar`, filas `Recibido / Valor tomado / Entrega`, `Nuevo canje` con su subtítulo, `Crear canje`, cálculo de campos `Valor tomado` / `Diferencia` en `frow`.
- **Clientes:** título, subtítulo `N clientes · M con saldo`, placeholder `Buscar por nombre, DNI o teléfono`, chips `Todos` / `Con saldo pendiente`, columnas `Cliente · DNI · Teléfono · Última compra · Gastado · Saldo`, avatar con iniciales + email en `small`, `Saldo $ 1,1M` compacto / `Sin saldo` gris, vacío `No encontré clientes.`. En desktop el estático **no** agrupa "Con saldo / Todos" (eso era solo mobile, 1119-1121), así que la tabla plana de React es correcta.
- **Detalle de cliente:** `.dhero` `Saldo pendiente`, filas `Teléfono` / `Email`, `Nueva venta` abre Registrar venta con el cliente preseleccionado.
- **Reportes:** tabs `Ventas / Stock / Canjes`, períodos `Semana / Mes / 3 meses / Año` (default `Mes`), textos de rango `últimos 7 días / 30 días / 3 meses / 12 meses`, eyebrow `Facturación` y `Canjes`, título de donut `Por medio de pago` / `Por estado`, barra seleccionada por defecto = la última y clic para seleccionar, reset de selección al cambiar tab/período, leyenda con `%` en Ventas y conteo en Stock/Canjes.
- **Menús contextuales:** clic derecho en filas de ventas, tarjetas de canje y filas de clientes; encabezado con `V-0001 · Cliente` / `C-0001 · Cliente` / nombre; `Editar` abre el modal de edición correspondiente; `Eliminar` en rojo.
- **Modales:** ancho 540 px, radio 24 px, padding `26px 28px`, cierre con clic en el fondo; React además cierra con `Escape` (el estático no lo hace para modales principales).

## Dudas / no verificable

- **Fuente de Reportes:** el desk calcula todo en el cliente con los arrays de `AppContext`; existe `fetchReportsOverview` (`src/services/reports-api.ts`) con series de inventario y canjes ya agrupadas en backend. No verifiqué si su granularidad (buckets) coincide con la del estático; decidir si el desk debe usarlo (resolvería RP-05 sin tocar el tipo `Product`).
- **Donut de Ventas, categoría `Canje + dif.`:** en el estático es un medio de pago más (1177). No está claro si en datos reales debe derivarse de `TradeIn.differencePaid` o si es un `paymentMethod` adicional (`CANJE`). No lo traté como desvío.
- **Etiquetas de cliente vs `ClientCategory`:** no confirmé si `ClientCategory` (usado como pestañas en `src/pages/Clients.tsx`) es semánticamente lo mismo que "etiqueta"; ver ET-01, opción (a) vs (b).
- **Formato real de `dateLabel`:** asumí `Intl.DateTimeFormat('es-AR', {day:'2-digit', month:'short', year:'numeric'})` → algo como `05 oct 2026`; el formato exacto (con o sin punto en el mes) depende de la versión de ICU de Node en Railway. En cualquier caso no coincide con `05/10/2026`.
- **Tamaño de fuente heredado en tarjetas de canje:** en CJ-02 asumo que `<button className="ticket">` hereda el font-size por defecto del navegador para `<button>` (≈13,3 px), porque `desk.css:24` solo hereda `font-family`. No lo medí en un navegador.
- **`.drep .gscroll > .gcard:first-of-type .gbars { height:260px }`** (820): en el DOM del estático el primer `div` de `.gscroll` es `.gtotal`, así que este selector no aplica y las barras quedan en 120 px (consistente con la captura 19). Tomé 120 px como referencia.
- **Toast de alta de venta/canje:** el estático usa `Venta V-0019 registrada` / `Canje C-0006 creado` (1499, 1511); React dice `Venta registrada` / `Canje creado`. No sé si la respuesta de `addSale` devuelve `saleNumber` a tiempo para armar el texto; detalle menor que no listé como desvío numerado.
- **Cálculo automático de diferencia en Nuevo canje** (`DeskOverlays.tsx:340`, diferencia = precio − valor tomado): no existe en el estático. Es una mejora; no lo marqué como desvío.
- No abrí la versión publicada en Railway; la comparación se hizo contra el HTML local y las capturas 13-19.
