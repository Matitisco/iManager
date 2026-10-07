# 02 · Inventario — auditoría de fidelidad (estático desktop vs React)

Referencia: `iManager-desktop-pantallas-v2/imanager-desk.html` (capa desktop desde la línea ~1593, que redefine `eqList`/`sInv`/`lpOpen`/`sgs`/`pill`) y capturas `02`–`12`.
Implementación: `src/desk/screens/InventoryScreen.tsx`, `src/desk/DeskOverlays.tsx`, `src/desk/ui.tsx`, `src/desk/desk.css`, `src/desk/format.ts`.

Convenciones: `HTML:N` = línea del estático; `archivo:N` = línea del React. Severidad: **Alta** = se ve a simple vista o falta funcionalidad; **Media** = diferencia de detalle notable; **Baja** = detalle fino.

> Nota de cascada CSS del estático: el archivo apila tres temas. Los valores efectivos son los últimos que ganan (tema claro `HTML:460-470`, "Paleta SaaS" `HTML:688-710`, desktop `HTML:725-885`). Los valores citados abajo ya son los efectivos.

---

## Pantalla Inventario

1. **IN-01** · **Severidad:** Media
   - **Estático:** `dimp()` `HTML:1609` → `<button class="dbtn s">` + SVG `I.up()` (`HTML:910`, `path d="M12 15V4M7 8.5l5-5 5 5M5 20h14"`, forzado a 16×16 por `.dbtn svg` `HTML:766`) + texto `Importar`. `dcta()` `HTML:1610` → `.dbtn p` + SVG `I.plus('#fff')` (`HTML:918`, `M12 5v14M5 12h14`) + `Registrar equipo`. Gap 8px entre ícono y texto.
   - **Implementado:** `InventoryScreen.tsx:44` texto `↑ Importar` (glifo Unicode) y `InventoryScreen.tsx:45` texto `+ Registrar equipo` (signo `+` tipográfico, no SVG).
   - **Cómo corregir:** crear en `src/desk/ui.tsx` íconos inline idénticos y usarlos:
     ```tsx
     const sv = (d: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
     export const IconUp = () => sv('M12 15V4M7 8.5l5-5 5 5M5 20h14');
     export const IconPlus = () => sv('M12 5v14M5 12h14');
     // InventoryScreen
     <button className="dbtn s" ...><IconUp />Importar</button>
     <button className="dbtn p" ...><IconPlus />Registrar equipo</button>
     ```
     Agregar `.dbtn svg { width: 16px; height: 16px; }` a `desk.css`.

2. **IN-02** · **Severidad:** Media — menú "Ordenar"
   - **Estático:** botón `<button class="dsel" data-act="pop-sort">Recientes ▾svg</button>` (`HTML:1647`); chevron `I.down` SVG 12×12 `stroke-width="3"` `path d="M6 9l6 6 6-6"` (`HTML:919`). `.dsel` `HTML:767`: `height:36px; padding:0 14px; border-radius:999px; gap:6px; font:13px/700`. Al click abre overlay `popmenu(['Recientes','Precio ↑','Precio ↓'], 'set-sort', cur)` (`HTML:1012-1014`, `1357`): `.ov.menu` transparente a pantalla completa (`#ovroot .ov.menu { justify-content:flex-end; align-items:flex-start; padding:140px 48px 0 0 }` `HTML:826`), `.popmenu` `width:200px; border-radius:18px; padding:6px; box-shadow:0 14px 40px rgba(0,0,0,.18); border:1px solid var(--border); animation: pop .16s` (`HTML:92`, `479`); ítems `padding:13px 12px; font:14px/700`; separador `button + button { border-top:1px solid var(--border) }` (`HTML:94`); ítem activo con `✓` al final (`.popmenu button.on::after { content:'✓'; margin-left:auto; font-weight:800 }` `HTML:646`). Click afuera cierra (`data-act="ov-close"`).
   - **Implementado:** `MenuButton` `ui.tsx:51-67`: label `"${sort} ▾"` con glifo Unicode (`InventoryScreen.tsx:50`); `<div class="dsel sm">` con un `<button>` interno (el padding del div no es clickeable); `.menu` `desk.css:68-70`: `min-width:160px; border-radius:14px`, ítems `padding:10px 12px; 13px`, activo = fondo lima suave (sin ✓), sin separadores, sin animación; **no cierra al hacer click afuera** ni con Escape (sólo toggle).
   - **Cómo corregir:** en `MenuButton` renderizar el botón como `.dsel` directo con el SVG chevron; al abrir montar un backdrop `position:fixed; inset:0` que cierre en `onMouseDown`, y Escape. CSS:
     ```css
     .menu { width:200px; border-radius:18px; padding:6px; box-shadow:0 14px 40px rgba(0,0,0,.18); animation: pop .16s ease-out; transform-origin: top right; }
     .menu button { display:flex; align-items:center; gap:10px; padding:13px 12px; font-size:14px; font-weight:700; border-radius:12px; }
     .menu button + button { border-top:1px solid var(--border); border-radius:0 0 12px 12px; }
     .menu button.on { background:none; } .menu button.on::after { content:'✓'; margin-left:auto; font-weight:800; }
     @keyframes pop { from { transform:scale(.94); opacity:0 } to { transform:none; opacity:1 } }
     ```

3. **IN-03** · **Severidad:** Media — mantener apretado + tip
   - **Estático:** long-press de 480 ms en filas (`pointerdown` `HTML:1426-1430`, cancela si el puntero se mueve >8px `HTML:1432`, o con scroll `HTML:1434`); mientras se mantiene, la fila recibe `.holding` → `background: var(--lime-soft)` (`HTML:789`); vibración de 12 ms; clic derecho también abre (`HTML:1435-1438`); se suprime el click posterior durante 700 ms (`HTML:1439`). Filas con `user-select:none` y `transition: background .12s` (`HTML:787`). Tip: `Tip: mantené apretada una fila (o clic derecho) para editar o eliminar.` con `.dhint { padding-left:4px }` (`HTML:1649`, `797`).
   - **Implementado:** sólo `onContextMenu` (`InventoryScreen.tsx:63-73`). Sin long-press, sin `.holding`, sin `user-select:none`, sin transición. Tip: `Tip: clic derecho en una fila para editar o eliminar.` (`InventoryScreen.tsx:92`); `.dhint` sin `padding-left` (`desk.css:135`).
   - **Cómo corregir:** hook `useLongPress(onOpen, 480)` en `src/desk/ui.tsx` (pointerdown → setTimeout; pointermove >8px / pointerup / pointercancel / scroll → cancelar; guarda `firedAt` para ignorar el click siguiente <700 ms) y aplicarlo a `<tr>` agregando/quitando la clase `holding`. CSS:
     ```css
     .dtable tbody tr { transition: background .12s; user-select: none; -webkit-user-select: none; }
     .dtable tbody tr.holding { background: var(--lime-soft); }
     .dhint { padding-left: 4px; }
     ```
     Texto exacto del tip: `Tip: mantené apretada una fila (o clic derecho) para editar o eliminar.`

4. **IN-04** · **Severidad:** Media — píldora de estado
   - **Estático:** `pill()` redefinido `HTML:1752-1753` → `<span class="spill cst" style="--pc:#25A66A">`. `.spill` `HTML:569`: `font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; white-space:nowrap` (sin altura fija, ≈20px). `.spill.cst` `HTML:852`: `background: color-mix(in srgb, var(--pc) 14%, #fff); color: color-mix(in srgb, var(--pc) 78%, #16181D)`. En la captura 02 las píldoras son chicas.
   - **Implementado:** `Pill` `ui.tsx:26-28` usa `.spill` sin `.cst`; `desk.css:136`: `height:26px; padding:0 10px; font-size:12px; font-weight:800; mix 16% / 72%` → píldora notablemente más grande y pesada.
   - **Cómo corregir:** `desk.css:136` → `.spill { display:inline-block; font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; white-space:nowrap; background: color-mix(in srgb, var(--pc) 14%, #fff); color: color-mix(in srgb, var(--pc) 78%, #16181D); }` (quitar `height` e `inline-flex`). Verificar que `.spill.mid/.lime/.off` sigan sobreescribiendo.

5. **IN-05** · **Severidad:** Alta — chips, píldoras y subtítulo no salen de un catálogo (no propagan cambios, capturas 08/09)
   - **Estático:** chips = `['Todos'].concat(EQ_ST.filter(s => s !== 'Reservado'))` (`HTML:1647`) donde `EQ_ST` es mutable y lo reescribe `saveSub` (`HTML:1803`); color de píldora vía `stColor` sobre `STC` (`HTML:1741`, `1804`); el filtro activo se remapea si se renombró (`HTML:1808`); `disp()` cuenta por `SN.eq['Disponible']` (`HTML:981`), así que tras reasignar "En revisión"→"Disponible" el subtítulo pasa a `3 equipos · 3 disponibles` y los chips muestran `Todos · Disponible · Señado · Vendido · En reparación` (captura 09).
   - **Implementado:** `FILTERS` hardcodeado (`InventoryScreen.tsx:7-12`); `statusLabel`/`statusColor` con mapas fijos (`format.ts:62-109`) → un estado nuevo se vería gris `#737984` y con su clave cruda; colores no editables.
   - **Cómo corregir:** depende de SE-02 (catálogo persistido). En el front: `const { catalogs } = useAppContext()`; `FILTERS = [{id:'Todos',label:'Todos'}, ...catalogs.eqStatus.filter(o => o.label !== 'Reservado').map(o => ({ id:o.value, label:o.label }))]` (para reproducir la captura 09, el filtro del estático excluye por *nombre* `Reservado`, por eso "Señado" sí aparece). `Pill` debe recibir `kind` y resolver `label`/`color` desde el catálogo (`statusLabel(status, catalog)`), con el fallback actual sólo si no hay match. Disponibles: contar `status === 'DISPONIBLE'` (clave estable, ver SE-02).

6. **IN-06** · **Severidad:** Baja — miniatura del equipo
   - **Estático:** `.dthumb` con `I.box('#16181D')` (`HTML:902`): SVG 22×22, `stroke-width 2.1`, `<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>` (`HTML:1642`).
   - **Implementado:** lucide `<Smartphone size={16} />` (`InventoryScreen.tsx:77`) — más chico y con otro trazo.
   - **Cómo corregir:** reemplazar por SVG inline 22×22 con esos paths (agregar `IconPhone` en `ui.tsx`).

7. **IN-07** · **Severidad:** Baja — buscador y barra derecha
   - **Estático:** `.xsearch { width:300px }` (`HTML:759`); ícono `I.search('#9CA3AF')` 18×18, `circle r=6.5`, `path M20 20l-4-4`, stroke 2.1 (`HTML:908`); `.dright` sin `flex-wrap` (`HTML:757`).
   - **Implementado:** `width:280px` (`desk.css:56`); `SearchIcon` 16×16, `r=7`, `M20 20l-3.5-3.5`, stroke 2.2 (`ui.tsx:124-130`); `.dright` con `flex-wrap:wrap; justify-content:flex-end` (`desk.css:55`).
   - **Cómo corregir:** `width:300px`; SVG 18×18 con `circle cx=11 cy=11 r=6.5` y `path d="M20 20l-4-4"`, `strokeWidth=2.1`, `strokeLinejoin="round"`. El `flex-wrap` puede quedar para anchos chicos (no afecta ≥1100px).

8. **IN-08** · **Severidad:** Baja — detalles de tabla
   - **Estático:** `.dcard .dtable th:first-child, td:first-child { padding-left:20px }` (`HTML:784`); `.dtable small { font-weight:500 }` (`HTML:790`); `.mono` sin letter-spacing (`HTML:793`).
   - **Implementado:** sin la regla de primera columna (queda 16px) (`desk.css:121-129`); `small` con `font-weight:600` (`desk.css:129`); `.mono { letter-spacing:.01em }` (`desk.css:130`).
   - **Cómo corregir:** agregar `.dcard .dtable th:first-child, .dcard .dtable td:first-child { padding-left:20px; }`, cambiar `small` a 500 y quitar el letter-spacing de `.mono`.

9. **IN-09** · **Severidad:** Baja — estado vacío
   - **Estático:** `<div class="wempty">No hay equipos con ese filtro.</div>` (`HTML:1640`); `.wempty` `HTML:512`+`709`: `padding:28px 10px; background:#fff; border:1px dashed #D9DCE1; border-radius:20px; font:13px/600`.
   - **Implementado:** mismo texto (`InventoryScreen.tsx:53`), pero `.wempty` `desk.css:157`: `border:1.5px dashed #D6D9DE; border-radius:14px; background:transparent; padding:28px 12px`.
   - **Cómo corregir:** separar `.wempty` de `.dempty` en `desk.css`: `.wempty { padding:28px 10px; background:#fff; border:1px dashed #D9DCE1; border-radius:20px; }`.

10. **IN-10** · **Severidad:** Baja — después de registrar
    - **Estático:** `save-eq` hace `state.f.inv = 'Todos'` y navega a `#/inv` (`HTML:1481`), así el equipo nuevo siempre se ve.
    - **Implementado:** `filter` es estado local de `InventoryScreen` (`InventoryScreen.tsx:18`); al crear con un chip distinto de "Todos" el equipo puede quedar oculto.
    - **Cómo corregir:** exponer un evento/flag en `useDesk` (p. ej. `onSaved('eq')`) o subir `filter` al `DeskApp` y resetearlo a `'Todos'` en el éxito de `addProduct`.

---

## Menú contextual

1. **CX-01** · **Severidad:** Media — íconos y separador
   - **Estático:** `HTML:1262-1265`: `<div class="ctxh">iPhone 14 Pro · 256GB</div>` + `<button data-act="ctx-edit">I.edit() Editar</button>` + `<button class="danger">I.trash() Eliminar</button>`. `I.edit()` `HTML:911` (18×18, stroke `#16181D`, `M4 20h4L19 9l-4-4L4 16z` + `M13.5 6.5l4 4`); `I.trash()` `HTML:912` (18×18, stroke `#DC4C4C`, `M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13`). Línea divisoria entre Editar y Eliminar por `.popmenu button + button { border-top:1px solid var(--border) }` (`HTML:94`) — visible en captura 04. `.danger` color `var(--err)` (`HTML:722`).
   - **Implementado:** `ContextMenu` `DeskOverlays.tsx:68-80`: botones sólo texto, sin íconos ni separador.
   - **Cómo corregir:** en `DeskOverlays.tsx:75-76` anteponer los SVG (gap 10px) y en `desk.css` `.ctx button + button { border-top:1px solid var(--border); border-radius:0 0 12px 12px; }`.

2. **CX-02** · **Severidad:** Media — posición
   - **Estático:** `lpOpen` desktop `HTML:1710-1717`: `top = r.bottom + 160 < innerHeight ? r.bottom + 4 : max(12, r.top - 150)` (anclado al **borde inferior de la fila**, o arriba si no entra); `left = min(innerWidth - 236, max(12, (clientX || r.right - 220) - 20))`.
   - **Implementado:** `DeskOverlays.tsx:73`: `top = min(clientY, innerHeight - 150)`, `left = min(clientX, innerWidth - 230)` (anclado al cursor).
   - **Cómo corregir:** en `onContextMenu` (`InventoryScreen.tsx:63`) pasar `rowRect = event.currentTarget.getBoundingClientRect()` y calcular igual que el estático: `y = rect.bottom + 160 < innerHeight ? rect.bottom + 4 : Math.max(12, rect.top - 150)`, `x = Math.min(innerWidth - 236, Math.max(12, event.clientX - 20))`.

3. **CX-03** · **Severidad:** Baja — medidas y fondo
   - **Estático:** backdrop `#ovroot .ov.ctxov { background: rgba(22,24,29,.08) }` (`HTML:827`); `.popmenu.ctxm { width:220px }` (`HTML:718`), `border-radius:18px; padding:6px; box-shadow:0 14px 40px rgba(0,0,0,.18); border:1px solid var(--border); animation: pop .16s ease-out` (`HTML:92`, `479`); `.ctxh { padding:10px 12px 8px }` (`HTML:719`); botones `padding:13px 12px; gap:10px`, sin hover.
   - **Implementado:** backdrop transparente (`DeskOverlays.tsx:72`); `.ctx { width:210px; border-radius:16px; box-shadow:0 14px 40px rgba(22,24,29,.2) }`, `.ctxh { padding:8px 10px }`, botones `padding:11px 10px; gap:8px; border-radius:10px` con hover `#F3F4F6` (`desk.css:234-238`); sin animación.
   - **Cómo corregir:** ajustar `desk.css:234-238` a esos valores, backdrop `rgba(22,24,29,.08)` y `animation: pop .16s ease-out; transform-origin: top right;`. (El hover puede quedarse: no rompe la referencia.)

---

## Detalle de equipo

1. **DE-01** · **Severidad:** Alta — cambio de estado en el detalle
   - **Estático:** `case 'eq'` `HTML:1257-1261`: después de Color/Condición/Batería hay `<label class="fl" style="margin-top:8px"><span>Estado</span></label>` + `sgs('st', EQ_ST, e.st)` → **selector segmentado interactivo con puntos de color y lapicito** (captura 03). Acciones: `Vender` (si `Disponible`) o `Cerrar`, y primario **`Guardar estado`** (`save-eq-st` `HTML:1472`: si cambió, guarda y muestra toast `"iPhone 13 · En revisión"`; cierra).
   - **Implementado:** `EquipmentDetail` `DeskOverlays.tsx:141-161`: fila `kv` "Estado" con `<Pill>` sólo lectura (`:152`) y primario **`Editar`** que abre el formulario completo (`:157`).
   - **Cómo corregir:** en `EquipmentDetail` agregar `const [status, setStatus] = useState(item.status)`; reemplazar el `kv` Estado por `<Field label="Estado" style={{marginTop:8}}><span/></Field><Segs options={eqStatusOptions} value={status} onChange={setStatus} onEdit={() => openSub('eqStatus')} />`; primario `Guardar estado` → `run(() => status !== item.status ? updateProduct({...item, status}) : Promise.resolve(), \`${item.model} · ${label(status)}\`)`. Si cambia a otro estado distinto de Disponible, el botón secundario pasa a `Cerrar` como en el estático (o mantener `Vender` según `item.status` original, que es lo que hace el estático).

2. **DE-02** · **Severidad:** Alta — forma de los botones de acción (afecta a TODOS los modales)
   - **Estático:** `.btn2 { height:52px; border-radius:999px; font-size:15px; font-weight:700 }` (`HTML:581`); `.btn2.p { background:#16181D; color:#fff; box-shadow:0 6px 18px rgba(0,0,0,.18) }` (`HTML:582`); `.btn2.s { background:var(--row) /* #F0F1F3 */; border:1.5px solid var(--border) }` (`HTML:583`, `707`). `.sacts { grid-template-columns:1fr 1.5fr; gap:10px; margin-top:16px }` (`HTML:626`). Capturas 03/05/10: botones tipo píldora grandes.
   - **Implementado:** `.btn2 { height:46px; border-radius:12px; font-size:14px; font-weight:800 }`, `.btn2.p` sin sombra, `.btn2.s` sin borde y `--row:#F7F8FA` (`desk.css:15`, `219-221`); `.sacts { 1fr 1.4fr; margin-top:8px }` (`desk.css:217`).
   - **Cómo corregir:** `desk.css`: `--row:#F0F1F3` (ojo: también lo usan inputs y `dhero`, que en el estático usan el mismo `#F0F1F3`), `.btn2 { height:52px; border-radius:999px; font-size:15px; font-weight:700; }`, `.btn2.p { box-shadow:0 6px 18px rgba(0,0,0,.18); }`, `.btn2.s { border:1.5px solid var(--border); }`, `.sacts { grid-template-columns:1fr 1.5fr; margin-top:16px; }`.

3. **DE-03** · **Severidad:** Media — contenedor del modal
   - **Estático:** backdrop `.ov { background: rgba(17,17,17,.45); animation: fadeIn .18s ease-out }` (`HTML:62`, `475`); `#ovroot .sheet-ov { width:540px; max-height:88vh; border-radius:24px; padding:26px 28px 24px; animation: pop .2s cubic-bezier(.2,.8,.2,1); box-shadow:0 30px 80px rgba(22,24,29,.25) }` (`HTML:824`), scrollbar oculta (`HTML:613-614`); `h3 { font-size:22px; font-weight:800; letter-spacing:-0.01em; margin-bottom:6px }` (`HTML:71`); `.sub { font-size:14px; font-weight:500; line-height:1.4; margin-bottom:16px }` (`HTML:72`).
   - **Implementado:** `.ov { background: rgba(22,24,29,.28) }` sin animación (`desk.css:204`); `.sheet { padding:26px 28px 22px }`, sin animación, scrollbar visible (`desk.css:205`); `h3` sin letter-spacing (`:206`); `.sub` `font-weight:600; margin:6px 0 16px` (`:207`).
   - **Cómo corregir:** `.ov { background:rgba(17,17,17,.45); animation: fadeIn .18s ease-out; }`, `.sheet { padding:26px 28px 24px; animation: pop .2s cubic-bezier(.2,.8,.2,1); scrollbar-width:none; } .sheet::-webkit-scrollbar{display:none}`, `.sheet h3 { letter-spacing:-.01em; }`, `.sheet .sub { font-weight:500; line-height:1.4; margin:0 0 16px; }` + keyframes `fadeIn`/`pop`.

4. **DE-04** · **Severidad:** Baja — hero de precio y filas kv
   - **Estático:** `.dhero { background:var(--row); border-radius:20px; padding:14px 16px; margin:0 !important }` (`HTML:632`, `778`); `.big { letter-spacing:-0.02em; margin-top:2px }` (`HTML:634`); `.kv { padding:12px 2px }`, `.kv span { font-weight:500 }` (`HTML:628-630`). Batería = `e.bat + '%'`.
   - **Implementado:** `.dhero { border-radius:16px; margin-bottom:8px }`, `.big` sin letter-spacing (`desk.css:226-228`); `.kv { padding:10px 0 }`, `span` 600 (`desk.css:223-224`). Batería `batteryPercent(...)` (`DeskOverlays.tsx:151`) convierte un rango `"83-85%"` en `83%`.
   - **Cómo corregir:** alinear CSS a esos valores. Para batería en el detalle mostrar el texto real si es rango: `/\d+\s*-\s*\d+/.test(b) ? b : \`${batteryPercent(b)}%\`` (el estático sólo tiene enteros; esto es dato real, no desvío visual).

---

## Editar equipo

1. **EE-01** · **Severidad:** Alta — falta el lapicito en Capacidad, Condición y Estado
   - **Estático:** `sgs` redefinido `HTML:1746-1751`: si las opciones son un catálogo (`kindOf`), agrega `<div class="sgs stg" data-k="cap|cond|eq">` + botón final `<button class="sg-edit" type="button" data-act="st-edit" data-k="…" title="Editar capacidades" aria-label="Editar capacidades">I_PEN</button>` (títulos: `Editar estados de equipo`, `Editar capacidades`, `Editar condiciones`). `I_PEN` `HTML:1742`: SVG 15×15 stroke 2, `M12 20h9` + `M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z`. CSS `.sg-edit` `HTML:850-851` (+`883`): `34×34; border-radius:50%; border:1.5px dashed #C9CDD4; background:#fff; color:#737984`; hover: `border-style:solid; border-color:#16181D; color:#16181D; background:#F5FBD7`. `.sgs.stg { gap:6px; align-items:center }`, `.sgs.stg .sg { padding:0 11px }` (`HTML:847-848`, `881-882`). Captura 05.
   - **Implementado:** `Segs` `ui.tsx:91-102` no tiene botón de edición; `EquipmentForm` usa `Segs` para capacidad/condición/estado (`DeskOverlays.tsx:182`, `189`, `198`).
   - **Cómo corregir:** extender `Segs`:
     ```tsx
     export function Segs({ options, value, onChange, onEdit, editLabel }: {...; onEdit?: () => void; editLabel?: string }) {
       return (
         <div className={`sgs${onEdit ? ' stg' : ''}`}>
           {options.map(o => <button key={o.id} type="button" className={`sg${o.id === value ? ' on' : ''}`} onClick={() => onChange(o.id)}>{o.color ? <i className="sd" style={{ background: o.color }} /> : null}{o.label}</button>)}
           {onEdit ? <button type="button" className="sg-edit" title={editLabel} aria-label={editLabel} onClick={onEdit}><IconPen /></button> : null}
         </div>
       );
     }
     ```
     Portar a `desk.css` las reglas `HTML:847-851` y `881-883`. El `onEdit` abre el submodal (SE-01) **apilado** sobre el formulario, sin cerrarlo.

2. **EE-02** · **Severidad:** Alta — estilo de las etiquetas de campo
   - **Estático:** `.fl > span { display:block; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color: var(--section) /* #9AA0AA */; margin-bottom:6px }` (`HTML:616`). Capturas: `MODELO`, `CAPACIDAD`, `BATERÍA %` en gris y mayúsculas.
   - **Implementado:** `.fl span { font-size:12px; font-weight:800; margin-bottom:6px }` color primario, sin mayúsculas (`desk.css:209`). Además el selector `.fl span` (descendiente) también afecta al `<span />` vacío que se pasa como hijo en `<Field label="Capacidad"><span /></Field>` (`DeskOverlays.tsx:181`, `188`, `192`, `197`), sumando 6px extra.
   - **Cómo corregir:** `desk.css:209` → `.fl > span { display:block; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#9AA0AA; margin-bottom:6px; }` y para los segmentados usar un label sin hijo: `<label className="fl"><span>Capacidad</span></label>` (o `Field` con `children` opcional).

3. **EE-03** · **Severidad:** Alta — validación por campo e IMEI
   - **Estático:** `need(['color','imei','precio'])` (`HTML:1004-1008`, `1528`) marca cada `.fl` faltante con `.bad`: `input { border-color: var(--err); box-shadow:0 0 0 3px var(--err-soft) }` y muestra debajo `<div class="err">Completá este dato</div>` (`HTML:999`, `619-621`, `704-705`; `font-size:12px; font-weight:700; margin-top:4px; color: var(--err)`). IMEI: `maxlength="15"` y si no tiene 15 dígitos → texto `El IMEI tiene 15 dígitos` (`HTML:1529`). El error se limpia al tipear (`HTML:1578`). **Precio obligatorio.**
   - **Implementado:** un único mensaje arriba `Completá modelo, color e IMEI.` (`DeskOverlays.tsx:200`, render en `:179`); precio no obligatorio (se puede guardar `$ 0`); IMEI acepta hasta 20 dígitos sin validar largo (`:187`); sin resaltado por campo.
   - **Cómo corregir:** estado `bad: Record<string,string>`; antes de `run`, calcular `if (!color.trim()) bad.color='Completá este dato'`; ídem `imei`, `price` (`parseMoney(price) === 0`); `if (imei && imei.length !== 15) bad.imei='El IMEI tiene 15 dígitos'`. `Field` recibe `error?: string` → `<label className={\`fl${error ? ' bad' : ''}\`}>…<div className="err">{error}</div></label>`; IMEI `maxLength={15}` y `slice(0, 15)`. CSS: `.fl.bad input { border-color:var(--err); background:#fff; box-shadow:0 0 0 3px var(--err-soft); } .fl .err { display:none; font-size:12px; font-weight:700; color:var(--err); margin-top:4px; } .fl.bad .err { display:block; }` (cuidado: hoy `.err` global en `desk.css:233` se usa para el error de backend; renombrar ese a `.ferr`). Mantener el error de backend arriba (regla "no cerrar como éxito").

4. **EE-04** · **Severidad:** Media — subtítulo
   - **Estático:** `sheet('Editar equipo', 'IMEI ' + imeiF(e.imei), …)` → `IMEI 35 000000 000001 0` (`HTML:1269`, captura 05).
   - **Implementado:** `Los datos se guardan en el inventario de la tienda.` para editar y registrar (`DeskOverlays.tsx:177`).
   - **Cómo corregir:** `subtitle={current ? \`IMEI ${formatImei(current.imei)}\` : 'Completá los datos del equipo. Lo podés editar después.'}`.

5. **EE-05** · **Severidad:** Media — Modelo
   - **Estático:** `sel('Modelo','mod', MODELS…)` → `<select>` con `iPhone 11, iPhone 12, iPhone 13, iPhone 13 Pro, iPhone 14, iPhone 14 Pro, iPhone 15, iPhone 15 Pro` (`HTML:1226`, `1270`); si el modelo actual no está, se antepone. `appearance:none` (sin flecha).
   - **Implementado:** `<input placeholder="Ej. iPhone 13">` texto libre (`DeskOverlays.tsx:180`).
   - **Cómo corregir:** como el inventario real tiene modelos arbitrarios, lo más fiel sin perder datos es mantener input con sugerencias: `<input list="desk-models" …/><datalist id="desk-models">{models.map(m => <option key={m} value={m} />)}</datalist>` donde `models` = lista del estático ∪ modelos distintos de `inventory`. Si se quiere fidelidad estricta, `<select>` con esas opciones + el actual. Sin placeholder (el estático no lo tiene).

6. **EE-06** · **Severidad:** Media — campo "Grado" extra
   - **Estático:** no existe campo Grado en editar/registrar. El grado se infiere: `Nuevo → '—'`; al pasar a Usado desde Nuevo → `'A'`; si no, se conserva (`HTML:1480`, `1531`).
   - **Implementado:** segmentado `Grado` `A+ / A / B / C` cuando condición ≠ NUEVO (`DeskOverlays.tsx:190-195`, `GRADES` `:59`).
   - **Cómo corregir:** para fidelidad, quitar el bloque `:190-195` y en el payload: `grade: condition === 'NUEVO' ? 'N/A' : (current?.grade && current.grade !== 'N/A' ? current.grade : 'A')`. Si producto quiere conservar la edición de grado (dato real útil), dejarlo documentado como desvío aceptado.

7. **EE-07** · **Severidad:** Media — opciones de Capacidad y Condición hardcodeadas
   - **Estático:** `CAP_OPTS = ['64GB','128GB','256GB','512GB']`, `COND_OPTS = ['Nuevo','Usado']` (`HTML:1233-1234`), editables vía submodal (las capturas 10–12 muestran `1TB` y `Reacondicionado` agregados por el usuario).
   - **Implementado:** `CAPS` incluye `1TB` fijo (`DeskOverlays.tsx:34`); `CONDITIONS` incluye `Pre-owned` fijo (`:35-39`).
   - **Cómo corregir:** leer ambos de `catalogs.capacity` / `catalogs.condition` (SC-02/SD-02). Defaults del seed: los del estático; para no perder datos existentes, al sembrar sumar los valores distintos ya presentes en `InventoryItem` (p. ej. `PRE-OWNED`, `1TB`).

8. **EE-08** · **Severidad:** Media — inputs
   - **Estático:** `.fl input, .fl select { height:48px; border-radius:14px; border:1.5px solid var(--border); background:var(--row) /* #F0F1F3 */; padding:0 14px; font-size:15px; font-weight:600 }`, focus `border-color:#16181D; background:#fff` (`HTML:617-618`, `702-703`).
   - **Implementado:** `height:42px; border-radius:12px; padding:0 12px; font-size:14px; background:#F7F8FA` (`desk.css:15`, `210`).
   - **Cómo corregir:** `desk.css:210` → `height:48px; border-radius:14px; padding:0 14px; font-size:15px;` y `--row:#F0F1F3` (ver DE-02). Separar `.stx-in` (que hoy comparte la regla) — tiene medidas propias (SE-01).

9. **EE-09** · **Severidad:** Media — Batería
   - **Estático:** `fld('Batería %','bat', …, '100', 'number', ' inputmode="numeric"')` (`HTML:1271`, `1294`): en *Registrar* el valor arranca vacío con **placeholder** `100` (captura 10); al guardar `Math.min(100, +bat || 100)` (nuevo) o `|| e.bat` (editar) (`HTML:1480`, `1531`).
   - **Implementado:** valor inicial `'100'` (no placeholder), sin `placeholder` (`DeskOverlays.tsx:170`, `185`); acepta hasta 999 (`slice(0,3)`) y vacío se guarda como `"0%"` (`:208`).
   - **Cómo corregir:** `useState(current ? String(batteryPercent(current.batteryHealth)) : '')`, `placeholder="100"`; al guardar: `const b = Math.min(100, Number(battery) || (current ? batteryPercent(current.batteryHealth) : 100)); batteryHealth: \`${b}%\``. Si el valor original era un rango (`"83-85%"`) y el usuario no lo tocó, conservar el string original.

10. **EE-10** · **Severidad:** Baja — segmentados
    - **Estático:** `.sg { height:38px; padding:0 14px; border:1.5px solid var(--border); font:13px/700 }` (`HTML:624`); en `.stg` `padding:0 11px` (`HTML:882`); punto `i.sd { width:8px; height:8px; margin-right:7px; box-shadow:0 0 0 1.5px rgba(255,255,255,.7) }` (`HTML:849`); separación de 12px después del grupo (`<div style="height:12px">`).
    - **Implementado:** `.sg { height:36px; padding:0 12px; gap:6px }`, punto sin sombra (`desk.css:214-216`).
    - **Cómo corregir:** `.sg { height:38px; padding:0 14px; }`, `.sgs.stg .sg { padding:0 11px; }`, `.sg i.sd { width:8px; height:8px; border-radius:50%; margin-right:7px; box-shadow:0 0 0 1.5px rgba(255,255,255,.7); }` y quitar el `gap` del botón para que mande el `margin-right`.

---

## Eliminar

1. **EL-01** · **Severidad:** Alta — diálogo centrado vs. hoja
   - **Estático:** `dialog(...)` `HTML:1009-1011`: `<div class="ov center"><div class="dialog">` → `max-width:340px; border-radius:26px; padding:24px 20px 18px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.4); animation: pop .2s` (`HTML:85`); `h3 20px/800 margin-bottom:8px`; `p 14px/500 line-height:1.45 margin-bottom:20px` (`HTML:86-87`); botones en `grid 1fr 1fr; gap:10px`, `height:48px; border-radius:999px; 14px/700` (`HTML:88-89`): `Cancelar` (`background:var(--row)`) y `Eliminar` (`.ok.danger { background: var(--err) }` `HTML:706`).
   - **Implementado:** `Sheet` de 540px, alineado a la izquierda, con `Actions` 1fr/1.4fr y radio 12 (`DeskOverlays.tsx:110-122`).
   - **Cómo corregir:** componente `Dialog` en `ui.tsx` (`.ov` + `.dialog`) y CSS portado de `HTML:85-91` con `.dialog .ok.danger { background: var(--err); }`. Mantener `busy` y el error de backend dentro del diálogo.

2. **EL-02** · **Severidad:** Media — textos
   - **Estático:** título `¿Eliminar este equipo?`, cuerpo `iPhone 14 Pro · 256GB se va a borrar y no se puede deshacer.` (`HTML:1238`, `1267`); toast `Equipo eliminado` (`HTML:1238`, `1526`).
   - **Implementado:** título `¿Eliminar?`, cuerpo `{label} se borra y no se puede deshacer.`, toast `Eliminado` (`DeskOverlays.tsx:112`, `119`).
   - **Cómo corregir:** mapa por tipo como `CTX`: `{ eq: { what:'este equipo', done:'Equipo eliminado' }, sale: { what:'esta venta', done:'Venta eliminada' }, cj: { what:'este canje', done:'Canje eliminado' }, cl: { what:'este cliente', done:'Cliente eliminado' } }` → título `¿Eliminar ${what}?`, cuerpo `${label} se va a borrar y no se puede deshacer.`.

---

## Registrar equipo

1. **RE-01** · **Severidad:** Alta — lapicito en Capacidad, Condición y Estado
   - **Estático:** `case 'new-eq'` `HTML:1292-1298` usa el mismo `sgs` con lapicito para `cap`, `cond` y `st` (captura 10: también muestra `1TB` y `Reacondicionado` agregados desde los submodales, capturas 11–12).
   - **Implementado:** `EquipmentForm` sin lapicito (`DeskOverlays.tsx:182`, `189`, `198`).
   - **Cómo corregir:** igual que EE-01 (mismo componente). Al guardar el submodal, el formulario abierto debe re-renderizar sus opciones conservando la selección (ver SE-09).

2. **RE-02** · **Severidad:** Media — subtítulo
   - **Estático:** `Completá los datos del equipo. Lo podés editar después.` (`HTML:1293`).
   - **Implementado:** `Los datos se guardan en el inventario de la tienda.` (`DeskOverlays.tsx:177`).
   - **Cómo corregir:** ver EE-04.

3. **RE-03** · **Severidad:** Media — valores iniciales
   - **Estático:** Modelo preseleccionado `iPhone 13` (`HTML:1294`); Capacidad `CAP_OPTS[1]` (`128GB`); Color vacío con placeholder `Ej. Azul`; Batería vacía con placeholder `100`; IMEI vacío con placeholder `15 dígitos`; Condición `COND_OPTS[1]` (`Usado`); Precio vacío placeholder `$ 0`; Estado `EQ_ST[0]` (`Disponible`).
   - **Implementado:** Modelo vacío (`DeskOverlays.tsx:167`); Batería con valor `100` en vez de placeholder (`:170`); el resto coincide.
   - **Cómo corregir:** `useState(current?.model ?? 'iPhone 13')` (si se usa datalist/select, EE-05) y batería según EE-09. Capacidad por defecto: `catalogs.capacity[1] ?? catalogs.capacity[0]`; condición: `catalogs.condition[1] ?? [0]`, como el estático.

---

## Submodal de estados

> En React **no existe** nada de este sistema (`ST_PAL`, `STK`, `STC`, `SN`, `SYS`, `openSub`, `renderSub`, `saveSub`, `useCount`). Los ítems siguientes describen el comportamiento a replicar.

1. **SE-01** · **Severidad:** Alta — submodal "Estados de equipo" (estructura y copy)
   - **Estático:** `renderSub` `HTML:1763-1789` montado en `#ovsub` (contenedor aparte, `HTML:1757`) **encima** del modal abierto: `#ovsub .ov { position:fixed; z-index:120; background:rgba(17,17,17,.32) }` (`HTML:853`). Caja `.dialog.stx { width:460px; text-align:left; padding:22px 22px 18px }` (+ `.dialog` radio 26, sombra, `pop`) (`HTML:854`). Cabecera `.stx-h`: `<h3>Estados de equipo</h3>` 18px + botón `.stx-x` `×` (32×32, círculo `#F0F1F3`, 20px) `aria-label="Cerrar"` (`HTML:855-857`). Texto `.stx-sub` (13px `#737984`, `margin:6px 0 14px`): `Tocá el color para cambiarlo. Si renombrás, se actualizan los equipos que lo usan.` Lista `.stx-list` `max-height:360px; overflow:auto`. Cada fila `.stx-row` (`flex; gap:10px; padding:8px 0; border-bottom:1px solid #F0F1F3`): swatch `.stx-sw` (26px, `border:3px solid #fff; box-shadow:0 0 0 1.5px #E6E8EC`, abierto `0 0 0 2px #16181D`, `title="Elegir color"`), input `.stx-in` (`height:38px; border:1.5px solid #E6E8EC; border-radius:10px; padding:0 12px; 14px/600; maxlength=20; placeholder="Nombre"`), contador `.stx-cnt` (12px `#737984`, `min-width:70px`, derecha): `2 equipos` / `1 equipo` / `0 equipos` / `nuevo`, y al final candado, papelera o `Deshacer` (SE-04/SE-06). Botón `.stx-add` `+ Agregar estado` (`height:40px; border:1.5px dashed #C9CDD4; border-radius:10px; 13.5px/700`; hover `border-color:#16181D; background:#F5FBD7`). Pie `.row` (`grid 1fr 1fr; margin-top:16px`): `Cancelar` / `Guardar` (`.ok` carbón). Capturas 06–07. Se abre desde el lapicito del Estado en Detalle, Editar y Registrar.
   - **Implementado:** inexistente.
   - **Cómo corregir:** nuevo `src/desk/CatalogEditor.tsx` con props `{ kind: 'eqStatus'|'capacity'|'condition'; onClose(): void }`; estado local `rows: { orig: string|null; value?: string; label: string; color?: string; system: boolean; deleted: boolean; reassignTo: number|null }[]`, `pal: number|null`, `err`, `badIndex`. Portar CSS `HTML:853-885` tal cual a `desk.css` (clases `stx-*`). Config por tipo:
     ```ts
     const KIND = {
       eqStatus:  { t:'Estados de equipo', add:'Agregar estado',   w:'este estado',     pr:'lo', colors:true  },
       capacity:  { t:'Capacidades',       add:'Agregar capacidad', w:'esta capacidad', pr:'la', colors:false },
       condition: { t:'Condiciones',       add:'Agregar condición', w:'esta condición', pr:'la', colors:false },
     };
     // sub: (colors ? 'Tocá el color para cambiarlo. ' : '') + `Si renombrás, se actualizan los equipos que ${pr} usan.`
     ```
     Contador: `inventory.filter(i => i.status === row.value).length` (o `capacity`/`condition`), singular `equipo` / plural `equipos`; filas nuevas → `nuevo`.

2. **SE-02** · **Severidad:** Alta — persistencia (requiere backend + schema)
   - **Estático:** catálogo en memoria (`EQ_ST`/`STC`/`SYS`), sin persistencia.
   - **Implementado:** no hay dónde guardar catálogos: `Store` no tiene campo de configuración (`backend/prisma/schema.prisma:25-46`); `InventoryItem.status` es `VarChar(20)` libre (`schema.prisma:124`) y el zod acepta cualquier string 1–20 (`inventory.routes.ts:33`). La lógica de negocio depende de claves fijas: ventas usan `"DISPONIBLE"`/`"VENDIDO"` (`backend/src/modules/sales/sales.service.ts:223`, `247`, `300-374`, `514`) y reportes también (`reports.service.ts:521-537`).
   - **Cómo corregir (propuesta):** modelo nuevo por tienda (preferible a un JSON en `Store` porque el borrado con reasignación debe ser transaccional y hay unicidad por tipo). Usar la skill `schema-change`.
     ```prisma
     enum CatalogKind { INVENTORY_STATUS INVENTORY_CAPACITY INVENTORY_CONDITION }
     model StoreCatalogOption {
       id        String      @id @default(cuid())
       storeId   String
       kind      CatalogKind
       value     String      @db.VarChar(20)   // lo que se guarda en InventoryItem.status/capacity/condition
       label     String      @db.VarChar(20)   // lo que se muestra (maxlength=20 como el estático)
       color     String?     @db.VarChar(9)    // sólo estados
       isSystem  Boolean     @default(false)
       sortOrder Int         @default(0)
       store     Store       @relation(fields: [storeId], references: [id], onDelete: Cascade)
       @@unique([storeId, kind, value])
       @@index([storeId, kind])
     }
     // + en Store: catalogOptions StoreCatalogOption[]
     ```
     - **Estados:** `value` es clave estable (`DISPONIBLE`, `EN_REVISION`, `RESERVADO`, `VENDIDO`; nuevos `ST_<8 chars>`), `isSystem` en `DISPONIBLE` y `VENDIDO` (igual que `STK.eq.sys = ['Disponible','Vendido']` `HTML:1723`). Renombrar = cambiar `label`, sin tocar ítems; ventas/reportes siguen funcionando.
     - **Capacidad/Condición:** los ítems guardan texto (`'128GB'`, `'USADO'`); `value` = valor guardado; renombrar hace `updateMany` de ítems. `isSystem` en `NUEVO` (la lógica de grado depende de él).
     - **API:** `GET /api/catalogs` (siembra defaults + valores distintos existentes si no hay filas) y `PUT /api/catalogs/:kind` con `{ options: [{ value?, label, color?, sortOrder }], deletions: [{ value, reassignTo }] }`. En `prisma.$transaction`: validar ≥1 opción, nombres no vacíos, sin duplicados (case-insensitive), que no se borre un `isSystem`; `inventoryItem.updateMany({ where:{ storeId, status: value }, data:{ status: reassignTo } })` por cada borrado (y por cada rename en cap/cond); upsert/delete de opciones. Responder el catálogo nuevo + conteos.
     - **Front:** `src/services/catalogs-api.ts`; en `AppContext` `catalogs` + `saveCatalog(kind, payload)` que al terminar hace `reloadInventory()` (o aplica el mapeo localmente). Si falla, mostrar error en el submodal y **no cerrarlo** (regla 4 del repo).

3. **SE-03** · **Severidad:** Alta — propagación de cambios (capturas 08 y 09)
   - **Estático:** `saveSub` `HTML:1790-1816`: arma `map` viejo→nuevo (renombres y reasignaciones de borrados), lo aplica a todos los equipos (`HTML:1802`), reemplaza el catálogo (`:1803`) y colores (`:1804`), actualiza nombres de sistema `SN` (`:1805`) y `SYS` (`:1806`), remapea el filtro activo de Inventario (`:1808`), **re-renderiza en el modal abierto los grupos segmentados de ese tipo conservando la selección mapeada** (`:1809-1812`) y re-renderiza la pantalla (`:1814`): chips nuevos, píldoras con color nuevo, subtítulo con disponibles recalculados.
   - **Implementado:** inexistente; además `Pill`/`statusLabel`/`statusColor` no leen catálogo (`ui.tsx:26-28`, `format.ts:103-109`).
   - **Cómo corregir:** con el catálogo en `AppContext` todo lo que lo lee se re-renderiza solo. Hace falta: (a) `statusLabel/statusColor` reciben el catálogo; (b) `EquipmentForm`/`EquipmentDetail` remapean su `useState` local si el valor seleccionado fue renombrado/borrado (`useEffect` sobre `catalogs` usando el `map` que devuelve `saveCatalog`); (c) `InventoryScreen` remapea `filter`. Ver IN-05.

4. **SE-04** · **Severidad:** Alta — eliminar con reasignación / deshacer
   - **Estático:** papelera `.stx-del` (34×34, radio 10, color `#9CA3AF`; hover `background:#FDECEC; color:#DC4C4C`; `I_TRASH` 16px `HTML:1743`; `title="Eliminar"`) (`HTML:868-869`). Al borrar (`HTML:1827`): fila `.del` → input tachado y deshabilitado (`text-decoration:line-through; color:#9CA3AF` `HTML:861`), swatch deshabilitado, el botón pasa a `Deshacer` (`.stx-undo`: `#F0F1F3`, radio 8, alto 30, 12px/700 `HTML:871`). Si hay equipos usándolo, debajo aparece `.stx-re` (`background:#FFF6E5; 12.5px; radio 10; padding:8px 10px; margin:6px 0 4px 36px` `HTML:875`): `1 equipo tiene este estado. Pasarlos a [select]` / `N equipos tienen este estado. Pasarlos a [select]`; el select (`height:30px; border:1.5px solid #E6E8EC; radio 8; 12.5px/600` `HTML:877`) lista las filas vivas con nombre, por defecto la primera viva (`HTML:1827`). Si no hay uso: `.stx-re.soft` `Se elimina al guardar.` (`#F7F8FA`, `#737984`). Captura 07.
   - **Implementado:** inexistente.
   - **Cómo corregir:** en `CatalogEditor`, `deleted` + `reassignTo` por fila; al guardar mandar `deletions: [{ value, reassignTo: rows[reassignTo].value ?? label }]` (si el destino es una fila nueva, el backend la crea primero dentro de la transacción).

5. **SE-05** · **Severidad:** Media — paleta de color
   - **Estático:** `ST_PAL` `HTML:1721`: `#25A66A Verde, #0F9D8A Turquesa, #3B82F6 Azul, #8B5CF6 Violeta, #EC4899 Rosa, #DC4C4C Rojo, #E8A33D Ámbar, #9DB51F Lima, #737984 Gris, #16181D Carbón`. Click en swatch abre/cierra la paleta bajo la fila (`.stx-pal { display:flex; flex-wrap:wrap; gap:8px; padding:10px 0 12px 36px }`, botones 24px `border:2px solid #fff; box-shadow:0 0 0 1px #E6E8EC`, seleccionado `0 0 0 2px #16181D`, `title`/`aria-label` con el nombre) (`HTML:872-874`, `1775`). Elegir color cierra la paleta (`HTML:1826`). Colores por defecto `STC.eq`: Disponible `#25A66A`, En revisión `#E8A33D`, Reservado `#3B82F6`, Vendido `#737984` (`HTML:1731`).
   - **Implementado:** inexistente (los colores por defecto sí coinciden en `DeskOverlays.tsx:40-45` y `format.ts:77-86`).
   - **Cómo corregir:** exportar `ST_PAL` en `src/desk/catalogs.ts` y renderizar igual; persistir en `StoreCatalogOption.color`.

6. **SE-06** · **Severidad:** Media — ítems del sistema (candado)
   - **Estático:** si `sys`, en lugar de papelera se muestra `<span class="stx-lock" title="Lo usa el sistema: se puede renombrar y cambiar de color, no borrar">I_LOCK</span>` (`HTML:1772`); `I_LOCK` 14px (`HTML:1744`); `.stx-lock { color:#C3C7CE; cursor:help }` 34×34 (`HTML:868`, `870`). Sistema en estados: `Disponible`, `Vendido` (captura 06).
   - **Implementado:** inexistente.
   - **Cómo corregir:** `isSystem` desde el backend (SE-02); el backend debe rechazar el borrado de un `isSystem` (no confiar sólo en la UI).

7. **SE-07** · **Severidad:** Media — validaciones al guardar
   - **Estático:** `saveSub` `HTML:1793-1799`: `Tiene que quedar al menos uno.`; `Hay uno sin nombre.` (marca la fila con `.bad` → `border-color:#DC4C4C` `HTML:862`); `«Nombre» está repetido.` (comparación sin mayúsculas, nombres con `trim`). Mensaje en `.stx-err` (`#DC4C4C`, 13px/600, `margin-top:10px` `HTML:880`) entre `+ Agregar…` y los botones. El submodal no se cierra.
   - **Implementado:** inexistente.
   - **Cómo corregir:** replicar exactamente esos textos (incluidas las comillas `« »`) en `CatalogEditor` y repetir la validación en el backend (400 con el mismo mensaje).

8. **SE-08** · **Severidad:** Media — agregar fila
   - **Estático:** `+ Agregar estado` agrega fila vacía con el **primer color de `ST_PAL` no usado** (o Gris) y hace foco en su input (`HTML:1829-1831`); contador `nuevo`; sin candado (papelera). Captura 07: `En reparación` en turquesa.
   - **Implementado:** inexistente.
   - **Cómo corregir:** `const used = rows.map(r => r.color); const color = (ST_PAL.find(p => !used.includes(p[0])) ?? ST_PAL[8])[0];` + `ref.focus()` en el último input tras el render.

9. **SE-09** · **Severidad:** Media — apilado, cierre y Escape
   - **Estático:** el submodal vive en `#ovsub` aparte, por encima del modal de Editar/Registrar/Detalle, que sigue visible debajo (capturas 06, 11, 12). Cierra con backdrop, `×`, `Cancelar` o **Escape**; el Escape se captura con `capture:true` y `stopPropagation()` (`HTML:1837`) para que no cierre el modal padre. Cancelar descarta todo.
   - **Implementado:** `DeskApp` tiene un único `overlay` (`DeskApp.tsx:32`); abrir otro reemplaza el formulario y se perdería lo tipeado. `Sheet` escucha Escape en `window` (`ui.tsx:70-74`): cerraría también el padre.
   - **Cómo corregir:** agregar en `DeskApp` un estado separado `sub: CatalogKind | null` y `openSub/closeSub` en `useDesk`; renderizar `<CatalogEditor>` después de `<DeskOverlays>` con `.ov` `z-index:120; background:rgba(17,17,17,.32)`. En `CatalogEditor` registrar `keydown` con `{ capture: true }` y `event.stopImmediatePropagation()`; en `Sheet` ignorar Escape si hay `sub` abierto.

10. **SE-10** · **Severidad:** Baja — toast de resumen
    - **Estático:** `toast('Cambios guardados' + ' · ' + [n nuevo(s), n renombrado(s), n eliminado(s)].join(', '))` (`HTML:1813-1815`) → p. ej. `Cambios guardados · 1 nuevo, 1 renombrado, 1 eliminado` (capturas 08/09) o `Cambios guardados · 1 nuevo` (capturas 10/12); sin cambios → `Cambios guardados`. Toast `HTML:56-58`+`829`: `top:20px; left:calc(50% + 124px)`, entra con `translate(-50%,-16px)→0` y `opacity` (`.2s/.25s`), `padding:11px 18px 11px 14px; gap:9px`, punto lima 9px, `max-width:400px; white-space:nowrap`, dura 2200 ms.
    - **Implementado:** el toast existe (`DeskApp.tsx:38-42`, `114`) pero sin animación, `left:calc(50% + 100px)`, `padding:11px 16px; gap:8px`, punto 8px, 2400 ms (`desk.css:239-240`).
    - **Cómo corregir:** generar el texto con la misma regla de plurales (`nuevo/nuevos`, `renombrado/renombrados`, `eliminado/eliminados`); en CSS alinear medidas y agregar `@keyframes toastIn { from { opacity:0; transform:translate(-50%,-16px) } to { opacity:1; transform:translate(-50%,0) } }`; `left: calc(50% + 124px)` (mitad del sidebar de 248px) y 2200 ms.

---

## Submodal de capacidades

1. **SC-01** · **Severidad:** Alta — submodal "Capacidades" inexistente
   - **Estático:** `STK.cap` `HTML:1727`: título `Capacidades`, botón `+ Agregar capacidad`, **sin colores** (`nc: true`: no hay swatch ni paleta y el botón segmentado no lleva punto `HTML:1749`, `1769`), **sin ítems de sistema** (todas con papelera), texto `Si renombrás, se actualizan los equipos que la usan.` (`HTML:1784`), reasignación `N equipos tienen esta capacidad. Pasarlos a …`, y `.dialog.stx.nc .stx-re { margin-left:0 }` (`HTML:885`). Contadores por `e.cap` (captura 11: `64GB 0 equipos`, `128GB 2 equipos`, `256GB 1 equipo`, `512GB 0 equipos`, `1TB nuevo`).
   - **Implementado:** inexistente; `CAPS` fijo (`DeskOverlays.tsx:34`).
   - **Cómo corregir:** mismo `CatalogEditor` con `kind='capacity'` (SE-01) y clase `nc` en el contenedor.

2. **SC-02** · **Severidad:** Media — datos reales de capacidad
   - **Estático:** coincidencia exacta de strings (`useCount` `HTML:1758`).
   - **Implementado:** `InventoryItem.capacity` es texto libre `VarChar(50)` (`schema.prisma:117`) y el import la guarda tal cual (`inventory.service.ts:534`); puede haber variantes (`128 GB`, `128gb`, vacío).
   - **Cómo corregir:** al sembrar el catálogo (SE-02) normalizar y unir los valores distintos existentes; en rename/borrado hacer `updateMany` por igualdad exacta. Un ítem con capacidad fuera del catálogo debe seguir mostrándose en la tabla, y en Editar aparecer como opción extra seleccionada (hoy no se selecciona ninguna, igual que el estático).

---

## Submodal de condiciones

1. **SD-01** · **Severidad:** Alta — submodal "Condiciones" inexistente
   - **Estático:** `STK.cond` `HTML:1728`: título `Condiciones`, `+ Agregar condición`, sin colores (`nc`), **`Nuevo` es de sistema** (candado), texto `Si renombrás, se actualizan los equipos que la usan.`, reasignación `… tienen esta condición. Pasarlos a …`. Captura 12: `Nuevo 1 equipo 🔒`, `Usado 2 equipos 🗑`, `Reacondicionado nuevo 🗑`.
   - **Implementado:** inexistente; `CONDITIONS` fijo con `Pre-owned` (`DeskOverlays.tsx:35-39`).
   - **Cómo corregir:** `CatalogEditor` con `kind='condition'`; `NUEVO` con `isSystem`.

2. **SD-02** · **Severidad:** Media — claves vs. etiquetas de condición
   - **Estático:** guarda la etiqueta (`'Usado'`) y usa `SN.cond['Nuevo']` para la lógica del grado (`HTML:1480`, `1531`).
   - **Implementado:** guarda claves en mayúsculas (`NUEVO`/`USADO`/`PRE-OWNED`) y las traduce con un mapa fijo (`format.ts:111-115`); la regla del grado compara con `'NUEVO'` (`DeskOverlays.tsx:190`, `207`); el import normaliza con `CONDITION_MAP` y **cae a `USADO`** para cualquier valor desconocido (`inventory.service.ts:463-471`, `493-501`, `536`), así que una condición personalizada importada se perdería.
   - **Cómo corregir:** catálogo con `value` (lo guardado) + `label` (lo mostrado); `conditionLabel(value, grade, catalog)`; la lógica de grado se ata al `value` de sistema `NUEVO`. En el import, buscar primero por `label`/`value` del catálogo de la tienda y recién después el mapa legado.

---

## Importar

1. **IM-01** · **Severidad:** Alta — el modal no usa el sistema visual del desk
   - **Estático:** `case 'import'` `HTML:1299-1305` usa `sheet()` (540px, radio 24, sin borde de cabecera, sin botón ×) con `.drop` (`border:2px dashed var(--border); border-radius:20px; padding:22px 16px; background:var(--row); text-align:center` `HTML:638-641`) y botones `.btn2` píldora.
   - **Implementado:** `ImportHost` (`DeskOverlays.tsx:566-578`) monta el `ImportModal` genérico de la tabla (`src/components/table-engine/components/ImportModal.tsx:278-300`): Tailwind `bg-black/50`, `max-w-2xl` (672px), `rounded-2xl`, cabecera con `border-b` y botón `X`, pie con `border-t` y botones `rounded-lg px-4 py-2`, animación spring de `motion`.
   - **Cómo corregir:** crear `src/desk/DeskImport.tsx` que reutilice la lógica del `ImportModal` (parseo de CSV/XLSX, mapeo) pero con el armado del desk: `<Sheet title="Importar equipos" subtitle="Subí un Excel o CSV con una fila por equipo.">` + `.drop` + `.sacts`. Alternativa mínima: agregar a `ImportModal` una prop `variant="desk"` que cambie contenedor y botones a `.ov/.sheet/.btn2`.

2. **IM-02** · **Severidad:** Media — textos del paso inicial
   - **Estático:** título `Importar equipos`, subtítulo `Subí un Excel o CSV con una fila por equipo.`, zona `<button class="drop">` con `I.up()` + `<b>Elegir archivo</b>` (15px/800) + `<small>Columnas: modelo, capacidad, color, IMEI, precio</small>` (12px/500) (`HTML:1244`, `1300-1303`); única acción `Cancelar` (`sacts one`).
   - **Implementado:** subtítulo `Subí un archivo CSV o XLSX`, zona `Arrastrá un archivo o hacé click para elegir` / `.csv, .xlsx — máx. 2000 filas` (`ImportModal.tsx:265`, `319-320`).
   - **Cómo corregir:** usar los textos del estático; se puede mantener el arrastrar-y-soltar (mejora no visible) y agregar el límite como segunda línea si se considera necesario.

3. **IM-03** · **Severidad:** Media — enlace a plantilla
   - **Estático:** `<div class="sheet-note" style="margin-top:10px">¿No tenés el formato? <b>Bajá la plantilla</b></div>` (`HTML:1304`; `.sheet-note` 12px, `var(--section)`, centrado `HTML:76`).
   - **Implementado:** no existe (no hay "plantilla" en `ImportModal.tsx`).
   - **Cómo corregir:** botón-enlace que genere en el cliente un CSV con encabezados `modelo,capacidad,color,IMEI,precio,condición,grado,batería,costo,estado` (coinciden con `hints` de `importConfig`, `DeskOverlays.tsx:597`) y lo descargue con `Blob` + `URL.createObjectURL`.

4. **IM-04** · **Severidad:** Media — estado "archivo listo"
   - **Estático:** con archivo: `.drop.ok` (`border-color:#16181D; background:#fff` `HTML:641`) con `I.file()` + nombre (`inventario.xlsx`) + `2 equipos detectados · listo para importar`, luego filas `kv` de vista previa (`iPhone 12 · 128GB · Blanco` → `$ 520.000`); acciones `Otro archivo` / `Importar 2 equipos` (`HTML:1301-1305`).
   - **Implementado:** flujo de varios pasos (hoja → fila de encabezados → mapeo en tabla → resultado) con otra estética (`ImportModal.tsx:340-590`).
   - **Cómo corregir:** si el mapeo automático por `hints` cubre los campos obligatorios, saltar directo a un paso "listo" con el armado del estático (`.drop.ok`, 3–5 filas `kv` `modelo · capacidad · color` → precio, botones `Otro archivo` / `Importar N equipos`); dejar el mapeo manual detrás de un enlace "Revisar columnas" sólo cuando falte algo. El paso "resultado" puede cerrarse con toast (IM-05) si no hubo errores.

5. **IM-05** · **Severidad:** Media — toast final
   - **Estático:** `2 equipos importados` (`HTML:1488`; patrón `${n} ${many} importados`).
   - **Implementado:** `Importación lista` (`DeskOverlays.tsx:574`).
   - **Cómo corregir:** `toast(\`${result.imported + result.updated} equipos importados\`)` (singular `equipo importado` si es 1); para otros tipos usar `ventas/clientes/canjes`.

6. **IM-06** · **Severidad:** Media — normalización de estado/condición en el import (backend)
   - **Estático:** n/a (import simulado).
   - **Implementado:** `STATUS_MAP` no incluye `reservado` y cualquier estado desconocido cae a `DISPONIBLE` (`inventory.service.ts:483-491`, `541`); condición desconocida cae a `USADO` (`:536`). Con catálogos personalizados esto mostraría como disponibles equipos que no lo están.
   - **Cómo corregir:** agregar `reservado: "RESERVADO"` ya mismo; con SE-02, resolver por `label`/`value` del catálogo de la tienda (sin distinguir mayúsculas ni acentos) antes del mapa legado, y reportar como error de fila (en vez de caer en silencio al valor por defecto) cuando no haya coincidencia.

---

## Cosas que ya coinciden

- Título `Inventario`, subtítulo `N equipos · M disponibles`, placeholder `Buscar modelo, color o IMEI`, búsqueda por modelo/capacidad/color/IMEI, chips `Todos / Disponible / En revisión / Vendido` (sin Reservado) y ordenamiento `Recientes / Precio ↑ / Precio ↓` con la misma lógica (el backend ya ordena por `createdAt desc`).
- Columnas y encabezados `Equipo · IMEI · Condición · Batería · Precio · Estado`; celda Equipo `modelo · capacidad` + color en `small`; IMEI con formato `2-6-6-1` (`format.ts:56-60` = `imeiF` `HTML:896`); condición `Usado · Grado A` y `Nuevo` sin grado; barra de batería `.dbat` 44×6 lima + `%`; precio `$ 1.100.000` alineado a la derecha y en negrita; hover de fila `#F9FAFB`; encabezados `#FBFBFC` 12px/700.
- Colores por defecto de estados (`#25A66A`, `#E8A33D`, `#3B82F6`, `#737984`) y orden `Disponible, En revisión, Reservado, Vendido`.
- Click en fila abre el detalle; clic derecho abre menú con encabezado `modelo · capacidad`, `Editar` y `Eliminar` (rojo); Editar abre el formulario y Eliminar la confirmación.
- Detalle: título `modelo · capacidad`, subtítulo `IMEI …`, hero `Precio de venta`, filas Color/Condición/Batería, `Vender` sólo si está Disponible (si no, `Cerrar`). Vender abre Registrar venta, pero **no** preselecciona el equipo (bug, ver **MV-12** en `03-ventas-canjes-clientes-reportes.md`).
- Formulario: orden de campos Modelo → Capacidad → [Color | Batería %] → IMEI → Condición → Precio de venta → Estado; placeholders `Ej. Azul`, `15 dígitos`, `$ 0`; precio con separador de miles al tipear; botones `Cancelar` / `Guardar cambios` / `Guardar equipo`; toasts `Equipo actualizado` / `Equipo cargado`; defaults 128GB / Usado / Disponible.
- Persistencia real: si el backend falla se muestra el error y el modal no se cierra (cumple la regla 4 del repo).
- Mejoras de React que no contradicen la referencia: Escape cierra los modales (el estático sólo lo hace en el submodal) y estado `Guardando…`.

## Dudas / no verificable

- No abrí el estático en vivo (Railway) ni el React corriendo: la comparación sale del código y de las capturas. Medidas en píxeles de las capturas (p. ej. alto real de la píldora) son estimadas.
- Si en la base hay estados legados con otro formato (p. ej. `Disponible` o `En revisión` como texto en vez de `DISPONIBLE`/`EN_REVISION`), los chips de `InventoryScreen.tsx:7-12` no los filtrarían. No lo pude verificar sin datos reales.
- Exclusión de `Reservado` en los chips: el estático la hace por *nombre* (`s !== 'Reservado'`), por eso al renombrar a "Señado" aparece el chip (captura 09). No queda claro si es intención de producto o un efecto del prototipo; conviene confirmarlo antes de decidir si se excluye por clave `RESERVADO`.
- Permisos: el estático no restringe quién edita catálogos. Falta definir si `STAFF` (Agente) puede crear/borrar estados o sólo `OWNER`/`MANAGER` (`StoreRole`).
- `Grado` editable (EE-06) y `Modelo` como texto libre (EE-05) son desvíos que pueden ser intencionales por los datos reales; requieren decisión de producto.
- No verifiqué si `ImportModal` maneja Escape ni cómo se ve el paso de mapeo con columnas personalizadas en el desk (no se pasa `extraColumns` desde `ImportHost`).
- Comportamiento del estático no cubierto en las capturas: el submodal también existe para estados de venta/canje y etiquetas de cliente (`STK.ve/cj/cl` `HTML:1724-1726`); queda fuera de este alcance pero comparte el mismo componente y modelo (`CatalogKind` se puede ampliar).
