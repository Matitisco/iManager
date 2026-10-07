# Auditoría de fidelidad hi-fi desk — Shell, Dashboard, Notificaciones, Configuración, Modales genéricos y Salida

- **Referencia:** `iManager-desktop-pantallas-v2/imanager-desk.html`, capa desktop (líneas 1593-1839) más la cascada CSS completa (6-886). Capturas usadas como referencia: `01-dashboard.png`, `20-configuracion.png` y `21-notificaciones.png`.
- **Implementación:** `src/desk/` (`DeskApp.tsx`, `ui.tsx`, `desk.css`, `format.ts`, `types.ts`, `DeskOverlays.tsx`, `screens/DashboardScreen.tsx`, `screens/AccountScreens.tsx`), montado en `src/App.tsx:141`.
- **Método:** lectura del HTML y del JSX/CSS línea por línea. Los valores "Estático" marcados como *computado* se midieron con Chrome headless (Playwright) sobre el HTML local, en un viewport de 1450×900. El prototipo aplica a la vez `.s-hoy .s-tickets .s-familia` sobre `.dscreen`, así que la cascada mobile+desktop solo se puede resolver midiendo.
- **Criterio:** no se listan las diferencias de *datos demo vs. datos reales*. Sí se listan las métricas o campos que el estático muestra y React omite o calcula distinto, con la fuente real que podría alimentarlos.

---

### Global

1. **GL-01** · **Severidad:** Alta
   - **Estático:** hay un router por hash. `parse()`/`route()` (`imanager-desk.html:1364-1381`) manejan `#/dash`, `#/inv`, `#/ven`, `#/rep`, `#/mas`, `#/canjes`, `#/clientes`, `#/config`, `#/notif` y `#/salida`, con `hashchange` en `boot()` (1586-1590). Un hash desconocido o `#/mas` cae en Dashboard (`html()` 1694-1700). Si no hay hash, hace `history.replaceState(null,'','#/dash')`. Cada cambio de ruta cierra el overlay (`setOverlay(null)` en 1380). Hay guardas: logueado no puede ver `#/salida`, deslogueado solo ve `#/salida` (1376-1377).
   - **Implementado:** la navegación vive solo en estado (`useState<DeskTab>('dashboard')` en `src/desk/DeskApp.tsx:31`). No hay hash, ni deep-link, ni botón atrás del navegador, y F5 vuelve siempre al Dashboard.
   - **Cómo corregir:** en `DeskApp.tsx`, sincronizar `tab` con `location.hash`:
     ```tsx
     const ROUTE: Record<DeskTab, string> = { dashboard: 'dash', inventory: 'inv', sales: 'ven', tradeins: 'canjes', clients: 'clientes', reports: 'rep', notifications: 'notif', settings: 'config' };
     const fromHash = (h: string): DeskTab => {
       const n = h.replace(/^#\/?/, '').split('/')[0];
       return (Object.keys(ROUTE) as DeskTab[]).find((k) => ROUTE[k] === n) ?? 'dashboard';
     };
     const [tab, setTab] = useState<DeskTab>(() => fromHash(window.location.hash));
     useEffect(() => {
       if (!window.location.hash) history.replaceState(null, '', '#/dash');
       const on = () => { setTab(fromHash(window.location.hash)); setOverlay(null); };
       window.addEventListener('hashchange', on);
       return () => window.removeEventListener('hashchange', on);
     }, []);
     const go = (next: DeskTab) => {
       if (isStaff && next === 'reports') return;
       const h = '#/' + ROUTE[next];
       if (location.hash === h) setTab(next); else location.hash = h;
     };
     ```
     Si `isStaff` y la ruta es `rep`, hacer `replaceState` a `#/dash`. La ruta `#/salida` se trata en **SA-01**.

2. **GL-02** · **Severidad:** Media
   - **Estático:** `html, body` usan `font-family: 'DM Sans'…` y `-webkit-font-smoothing: antialiased` (línea 15). El `line-height` es `normal` (*computado*: `lineHeight=normal` en `body`). Además, `[data-act] { cursor: pointer; user-select: none }` (19).
   - **Implementado:** `src/index.css` carga Tailwind 4 (`@import "tailwindcss"`), cuyo preflight fija `html { line-height: 1.5 }` y la fuente Inter. `.desk-app` (`desk.css:3-23`) pisa la fuente pero no el `line-height` ni el suavizado. Resultado: todo bloque de texto multilínea queda más alto (cards, tickets, subtítulos, modales) y las alturas no fijas difieren.
   - **Cómo corregir:** en `desk.css`, en `.desk-app`, agregar `line-height: normal; -webkit-font-smoothing: antialiased;`. Los elementos con `line-height` explícito en el estático lo mantienen: `.dtop h1` 1.1, `.sheet .sub` 1.4, `.dialog p` 1.45, `.items` 1.45, `.s-out p` 1.5.

3. **GL-03** · **Severidad:** Baja
   - **Estático:** `fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800` (línea 5), sin eje `opsz`.
   - **Implementado:** `desk.css:1` pide `DM+Sans:ital,opsz,wght@0,9..40,400;…`. Con el eje `opsz` y `font-optical-sizing:auto`, los títulos de 30-34px se renderizan con otra óptica (más finos y apretados) que en la referencia.
   - **Cómo corregir:** reemplazar el `@import` por `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`, o agregar `font-optical-sizing: none` en `.desk-app`.

4. **GL-04** · **Severidad:** Media
   - **Estático:** el `:root` final (460-470) define `--bg #F7F8FA`, `--bg-deep #EEF0F3`, `--lime #DDF43B`, `--lime-soft #F5FBD7`, `--blue #5B8DEF`, `--card #FFF`, `--on-dark-muted #737984`, `--primary #16181D`, `--secondary #737984`, **`--section #9AA0AA`**, **`--row #F0F1F3`**, `--border #E6E8EC`, `--ok #25A66A`, `--ok-soft #E6F5EE`, `--err #DC4C4C`, `--err-soft #FCEDED`, `--c-green #397964`, `--c-blue #5B8DEF`, `--c-pink #DF668B`, `--c-lime #DDF43B` y `--sh: 0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.05)`.
   - **Implementado:** `desk.css:3-15` define **`--row: #F7F8FA`** (igual a `--bg`, cuando debería ser `#F0F1F3`). Faltan `--section`, `--bg-deep`, `--blue`, `--c-*` y `--sh`, y hay colores hardcodeados (`#9AA0AA` en `desk.css:99,227`). Como `--row` es el fondo de inputs, `btn2.s`, `.mini .ico`, `.dhero`, `.linkrow`, `.spill.mid` y `.kv`, todos quedan casi invisibles contra el fondo de página.
   - **Cómo corregir:** en `.desk-app`, poner `--row: #F0F1F3;` y agregar `--section: #9AA0AA; --bg-deep: #EEF0F3; --blue: #5B8DEF; --c-green: #397964; --c-blue: #5B8DEF; --c-pink: #DF668B; --c-lime: #DDF43B; --sh: 0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.05);`. Después, reemplazar los `#9AA0AA` literales por `var(--section)`.

5. **GL-05** · **Severidad:** Media
   - **Estático:** todas las tarjetas "de contenido" tienen borde de 1px `var(--border)` **y** la sombra `var(--sh)` (línea 484: `.s-hoy .hero, .s-hoy .mini, .s-tickets .ticket, .s-familia .card, .kcard…`). *Computado* en `.hero.dhero`, `.mini.dk`, `.dcard .ticket` y `.card`: `boxShadow=rgba(0,0,0,.04) 0 1px 2px, rgba(0,0,0,.05) 0 4px 14px`. `.dcard` (769) **no** lleva sombra.
   - **Implementado:** `.hero` (`desk.css:90`) y `.mini` (`desk.css:108`) no tienen sombra; `.ticket` (`desk.css:150`) usa `0 1px 2px rgba(22,24,29,.04)` y no tiene borde.
   - **Cómo corregir:** agregar `box-shadow: var(--sh);` a `.hero`, `.mini` y al contenedor tipo `.card` (ver **CF-02**). En `.ticket`, poner `border: 1px solid var(--border); box-shadow: var(--sh);`. Los hovers se mantienen: `.mini.dk:hover` y `.dcard .ticket:hover` usan `0 6px 20px rgba(22,24,29,.06)` (780).

6. **GL-06** · **Severidad:** Baja
   - **Estático:** paleta de avatares `.av-c` (537-538): 40×40, 13px/800; `.b` = `--c-blue #5B8DEF`, `.p` = `--c-pink #DF668B`, `.g` = `--c-green #397964`, `.l` = lima con texto `#16181D`, `.k` = `#16181D`. En el header del dashboard, `.av` / `.av.a` / `.av.g` usan los mismos `--c-*` (520-521).
   - **Implementado:** `desk.css:159-163` usa `.av-c` 36×36/12px, `.p #F85582`, `.g #25A66A`, y agrega un `.a #8B5CF6` que no existe en el estático. Faltan `.l` y `.k`.
   - **Cómo corregir:** `.av-c { width:40px; height:40px; font-size:13px }` (salvo `.dcell .av-c`, que es 36/13). `.av-c.p, .av.p { background: var(--c-pink) }`, `.av-c.g, .av.g { background: var(--c-green) }`, `.av-c.l { background: var(--c-lime); color:#16181D }`, `.av-c.k { background:#16181D }`. Eliminar `.a` y, en `format.ts:156-161` (`avatarTone`), usar `['b','p','g']`.

7. **GL-07** · **Severidad:** Media
   - **Estático:** `.spill` (569) mide 11px/700, `padding: 3px 9px`, `border-radius: 999px`, sin alto fijo (*computado* ~20px de alto). Variantes finales: `.ok` → `--ok-soft`/`#1C7F51` (694); `.lime` → `--lime-soft`/`--primary` (695); `.mid` → `--row`/`#5B616B` + borde 1px `--border` (696); **`.off` → fondo `#16181D`, texto `#fff`** (572); `.no` → transparente, texto `--err`, borde 1px dashed `rgba(220,76,76,.45)` (573+697). Estados con color: `.spill.cst` usa `background: color-mix(in srgb, var(--pc) 14%, #fff); color: color-mix(in srgb, var(--pc) 78%, #16181D)` (852).
   - **Implementado:** `.spill` (`desk.css:136`) es `height: 26px; padding: 0 10px; font-size: 12px; font-weight: 800`, con mezcla **16% / 72%**. `.spill.off` es `#FDECEC`/`#9A3030` (rojo claro), cuando debería ser negro. Faltan `.ok` y `.no`.
   - **Cómo corregir:** en `desk.css`:
     ```css
     .spill { display:inline-block; font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; white-space:nowrap; }
     .spill.cst, .spill[style*="--pc"] { background: color-mix(in srgb, var(--pc) 14%, #fff); color: color-mix(in srgb, var(--pc) 78%, #16181D); }
     .spill.off { background:#16181D; color:#fff; }
     .spill.ok { background: var(--ok-soft); color:#1C7F51; }
     .spill.no { background:transparent; color: var(--err); border:1px dashed rgba(220,76,76,.45); }
     ```
     Y en `ui.tsx:26-28` (`Pill`), usar `className="spill cst"`.

8. **GL-08** · **Severidad:** Media
   - **Estático:** `.wlink` (511) mide 13px/700, color `#16181D`, con **`text-decoration: underline; text-underline-offset: 3px`** y `padding: 2px`. Se usa en "Ver todas" / "Ver todos" del Dashboard y en "Leer todas" de Notificaciones (*computado*: subrayado, color `rgb(22,24,29)`). Se ve en `01-dashboard.png` y `21-notificaciones.png`.
   - **Implementado:** `.wlink` (`desk.css:81-82`) es color `var(--secondary)`, sin subrayado, y en hover pasa a `--primary`.
   - **Cómo corregir:** `.wlink { font-size:13px; font-weight:700; color:#16181D; text-decoration:underline; text-underline-offset:3px; padding:2px; }`. Quitar la regla de hover o dejarla sin cambio de color.

9. **GL-09** · **Severidad:** Media
   - **Estático:** en cada cambio de ruta (salvo el primer render), la pantalla nueva entra con `.dscreen.enter-f { animation: inF .2s ease-out }`, donde `@keyframes inF { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform:none } }` (37, 751, `render()` 1702-1708). Con `prefers-reduced-motion` no anima (39).
   - **Implementado:** no hay ninguna transición de pantalla (`DeskApp.tsx:104-113`).
   - **Cómo corregir:** envolver la pantalla activa con `key={tab}` y una clase de entrada, por ejemplo `<div key={tab} className="dscreen-enter">…</div>`, o pasar la clase `enter-f` al `.dscreen` de cada screen. En CSS: `.dscreen.enter-f{animation:inF .2s ease-out} @keyframes inF{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}} @media (prefers-reduced-motion: reduce){.dscreen{animation:none!important}}`. No animar en el primer montaje.

10. **GL-10** · **Severidad:** Media
    - **Estático:** el toast queda siempre montado (`#toast`, línea 888) y `toast()` (988-993) alterna `.show`. CSS (56-58 + 476 + 829): `position: fixed; top: 20px; left: calc(50% + 124px); transform: translate(-50%,-16px); opacity: 0` que pasa a `.show { opacity: 1; transform: translate(-50%,0) }` con `transition: opacity .2s, transform .25s cubic-bezier(.2,.8,.2,1)`. `padding: 11px 18px 11px 14px; gap: 9px; box-shadow: 0 10px 28px rgba(0,0,0,.35); max-width: 400px; white-space: nowrap; z-index: 90`. El punto mide 9×9 en lima. Duración: **2200 ms**. *Computado:* el centro del toast cae en x=849, que es exactamente el centro del área de contenido (248 + 1202/2).
    - **Implementado:** `DeskApp.tsx:38-42,114` monta y desmonta sin animación, con duración 2400 ms. `desk.css:239-240` usa `top: 18px; left: calc(50% + 100px)` (queda descentrado 24px), `padding: 11px 16px; gap: 8px`, sombra .25, punto 8×8, `z-index: 100`, sin `max-width`/`nowrap`.
    - **Cómo corregir:** renderizar siempre `<div className={`toast${message ? ' show' : ''}`}><i />{message}</div>` (conservando el último texto durante el fade-out), con un timer de 2200 ms. Copiar el CSS literal de las líneas 56-58 con `position: fixed; top: 20px; left: calc(50% + 124px)`.

11. **GL-11** · **Severidad:** Baja
    - **Estático:** `.wempty` (513+709) mide 13px/600, color `--secondary`, `padding: 28px 10px`, **fondo `#fff`**, `border: 1px dashed #D9DCE1`, `border-radius: 20px`. `.dempty` (807) es otra clase (kanban) con 1.5px dashed `#D6D9DE` y radio 14.
    - **Implementado:** `desk.css:157` unifica `.dempty, .wempty` con 1.5px dashed `#D6D9DE`, radio 14, fondo transparente y `padding: 28px 12px`.
    - **Cómo corregir:** separar las reglas: `.wempty { text-align:center; color:var(--secondary); font-size:13px; font-weight:600; padding:28px 10px; background:#fff; border:1px dashed #D9DCE1; border-radius:20px; }`.

12. **GL-12** · **Severidad:** Media
    - **Estático:** con `@media (max-width:1100px)` (832), `.dgrid.dash` y `.dgrid.two` pasan a **una columna**, `.dstats` a 2 columnas y `.xsearch` a 220px. La sidebar no colapsa.
    - **Implementado:** `desk.css:248-255` pasa `.dgrid.dash`/`.dgrid.two` a **2 columnas**, `.xsearch` a 200px y **colapsa la sidebar a 76px** (solo íconos). También agrega un breakpoint de 760px (256-261) que no existe en el estático.
    - **Cómo corregir:** dentro de `@media (max-width:1100px)`, usar `.dgrid.dash, .dgrid.two { grid-template-columns: 1fr }`, `.dstats { grid-template-columns: 1fr 1fr }` y `.xsearch { width: 220px }`. Quitar el colapso de `.side` (o moverlo a un breakpoint más chico, como decisión explícita).

13. **GL-13** · **Severidad:** Media
    - **Estático:** las filas y tarjetas con `data-act` en `eq|ve|cj|cl` y `data-id` abren el menú contextual con **mantener apretado 480 ms** (`pointerdown` en 1426-1430; se cancela si el puntero se mueve más de 8px o hay scroll, 1431-1434) **o con clic derecho** (1435-1438). Mientras se mantiene apretado, la fila recibe `.holding` (`.dtable tbody tr.holding { background: var(--lime-soft) }` en 789; tickets `transform: scale(.98)` en 714). Se ignoran los clics hasta 700 ms después de abrir (1439). Posición del menú (`lpOpen` desktop, 1710-1717): `top = rect.bottom+4` si `rect.bottom+160 < innerHeight`, si no `max(12, rect.top-150)`; `left = min(innerWidth-236, max(12, pointerX-20))`.
    - **Implementado:** solo hay `onContextMenu` (por ejemplo `SalesScreen.tsx:86`), sin long-press ni `.holding`. La posición usa `clientX/clientY` del clic (`DeskOverlays.tsx:73`).
    - **Cómo corregir:** crear `useLongPress(open)` en `ui.tsx`: `onPointerDown` arranca un timer de 480 ms y agrega la clase `holding`; `onPointerMove` con distancia mayor a 8 cancela; `onPointerUp/Cancel` y el scroll (capture) cancelan; al disparar guarda `firedAt` y suprime el `onClick` durante 700 ms. Aplicar el mismo cálculo de `top/left` que en el estático usando `getBoundingClientRect()` de la fila. CSS: `.dtable tbody tr.holding{background:var(--lime-soft)} .ticket.holding{transform:scale(.98);transition:transform .45s ease}`.

14. **GL-14** · **Severidad:** Baja
    - **Estático:** micro-interacciones:
      - `[data-act] { user-select:none }` (19).
      - `.mini:active, .ticket:active { transform: scale(.98) }` con `transition: transform .12s` (153, 160, 175).
      - `.ditem { transition: background .15s }` (737).
      - `.wchip { transition: background .15s, color .15s }` (502).
      - `.dtable tbody tr { transition: background .12s; user-select:none }` (787).
    - **Implementado:** ninguna de estas transiciones ni estados `:active` en `desk.css`.
    - **Cómo corregir:** agregar las reglas tal cual a `.ditem`, `.wchip`, `.mini`, `.ticket` y `.dtable tbody tr`, más `user-select:none` en elementos clicables (`.ditem`, `.mini`, `.ticket`, `.dtable tbody tr`, `.member` clicable).

15. **GL-15** · **Severidad:** Baja
    - **Estático:** `.xsearch` (759-761, 833) mide `width: 300px`. El ícono `I.search('#9CA3AF')` (908) es de **18px**, `stroke-width: 2.1`, con `<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>`. El `input` usa `font: inherit; font-size: 14px` y placeholder `#9CA3AF`.
    - **Implementado:** `.xsearch` mide 280px (`desk.css:56`). `SearchIcon` (`ui.tsx:124-130`) es de 16px, stroke 2.2, `r="7"`, `M20 20l-3.5-3.5`.
    - **Cómo corregir:** `width: 300px`, y en `SearchIcon` usar `width/height=18`, `strokeWidth="2.1"`, `strokeLinejoin="round"` y los paths del estático.

16. **GL-16** · **Severidad:** Baja
    - **Estático:** `.dsel` (766) mide 36px de alto, radio 999, 13px/700, y su contenido es `texto + ' ' + I.down` (chevron 12px, `stroke-width: 3`, `<path d="M6 9l6 6 6-6"/>`, 919). Abre un `popmenu` (`.ov.menu` fijo arriba a la derecha: `padding: 140px 48px 0 0`, 826; `.popmenu` de 200px, radio 18, `padding: 6px`, animación `pop .16s`; opción activa con `::after '✓'`, 646).
    - **Implementado:** `MenuButton` (`ui.tsx:51-67`) es un dropdown absoluto (`.menu`, `desk.css:68-70`) sin chevron ni ✓, y la opción activa se marca con fondo lima. La base `.dsel` (`desk.css:66`) mide 42px con radio 12.
    - **Cómo corregir:** dejar la base `.dsel` en `height:36px; border-radius:999px; font-size:13px`. Agregar el chevron SVG después del label. En `.menu button.on`, usar `::after { content:'✓'; margin-left:auto; font-weight:800 }` en lugar del fondo lima, y en el menú `border-radius:18px; animation: pop .16s ease-out`. Esto aplica a los dtop de Inventario y Ventas.

17. **GL-17** · **Severidad:** Baja
    - **Estático:** `route()` llama a `setOverlay(null)` en cada navegación (1380).
    - **Implementado:** `go()` (`DeskApp.tsx:44-47`) no cierra el overlay.
    - **Cómo corregir:** dentro del handler de `hashchange` (ver **GL-01**) o en `go`, llamar a `setOverlay(null)`.

### Sidebar

1. **SH-01** · **Severidad:** Media
   - **Estático:** íconos propios definidos con `sv()` (899): `stroke="currentColor"` fijado a `#16181D` si el ítem está activo o `#737984` si no (1600), `stroke-width: 2.1`, `linecap/linejoin: round`. Tamaños: Dashboard/Inventario/Ventas/Reportes **22px**; Canjes/Clientes/Notificaciones/Configuración **18px**. Paths:
     - Dashboard `I.grid`: `<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>`.
     - Inventario `I.list`: `<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 10h17M8 14.5h8"/>` (bandeja, **no** celular).
     - Ventas `I.vcart`: `<path d="M3 4h2.5l2 11h10.5l2-8H7"/><circle cx="9.5" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>`.
     - Canjes `I.swap`: `<path d="M7 7h12l-3-3M17 17H5l3 3"/>` (dos flechas opuestas).
     - Clientes `I.user`: `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>` (una persona).
     - Reportes: `<path d="M5 20V10M10 20V5M15 20v-7M20 20V8"/>` (4 barras sin eje).
     - Notificaciones: `<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>`.
     - Configuración `I.gear`: `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>` (sol con 8 rayos, como se ve en `20-configuracion.png`).

     En hover el texto pasa a `--primary`, pero el ícono **queda `#737984`**, porque el stroke es explícito.
   - **Implementado:** `DeskApp.tsx:58-65,90,94` usa lucide: `LayoutGrid`, **`Smartphone`** (Inventario), `ShoppingCart`, **`RefreshCcw`** (Canjes), **`Users`** (Clientes), `BarChart3`, `Bell` y **`Settings`** (engranaje). Todos de 18px con `strokeWidth` 2, heredando `currentColor` (en hover el ícono también se oscurece).
   - **Cómo corregir:** crear en `ui.tsx` un `DeskIcon` (`<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">`) con los paths de arriba, y usarlo en `items` con los tamaños indicados. Para que el ícono no cambie en hover: `.ditem .dic { color: #737984 } .ditem.on .dic { color: #16181D }`.

2. **SH-02** · **Severidad:** Media
   - **Estático:** debajo de `.duser` no hay nada más (`sideHTML` 1599-1605). El cierre de sesión está solo en Configuración y pasa por un diálogo.
   - **Implementado:** `DeskApp.tsx:102` agrega un botón `wlink` "Cerrar sesión" bajo el usuario, que llama a `logout()` directo, sin confirmación.
   - **Cómo corregir:** eliminar la línea 102.

3. **SH-03** · **Severidad:** Baja
   - **Estático:** `.dlogo` mide 38×38, radio 12, lima, con `I.logo` reescalado a **22×22** (1602; *computado*: svg de 22×22), stroke `#16181D` 2.2: `<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>`.
   - **Implementado:** `DeskApp.tsx:72` usa `<Smartphone size={18} strokeWidth={2.4} />`.
   - **Cómo corregir:** usar el SVG literal a 22px con `strokeWidth 2.2`.

4. **SH-04** · **Severidad:** Baja
   - **Estático:** `.side` tiene `gap: 4px` entre bloques (729). *Computado*: la etiqueta "CUENTA" está en y=346, el usuario en y=824.
   - **Implementado:** `.side` (`desk.css:28`) no define `gap`, así que todo el bloque Cuenta queda unos 4-8px más arriba.
   - **Cómo corregir:** agregar `gap: 4px` en `.side`.

5. **SH-05** · **Severidad:** Baja
   - **Estático:** el avatar de `.duser` es `.av-c` de 40×40, 13px/800 (*computado*).
   - **Implementado:** 36×36, 12px (`desk.css:159`).
   - **Cómo corregir:** se resuelve con **GL-06**.

6. **SH-06** · **Severidad:** Baja
   - **Estático:** el contador `.dmeta` de Canjes muestra `cjOpen()`, que **solo** cuenta Pendiente, Peritaje téc. y En revisión (983). Aprobado no cuenta.
   - **Implementado:** `DeskApp.tsx:35` cuenta todo lo que no sea `LISTO`/`RECHAZADO` (incluye `APROBADO`). Tampoco usa el helper `isOpenTrade` de `format.ts:163-167`, que también incluye Aprobado.
   - **Cómo corregir:** unificar en un helper `isInProgressTrade = s => ['PENDIENTE','PERITAJE TÉC.','EN REVISIÓN'].includes(s)` y usarlo en la sidebar, en el KPI y en la lista del Dashboard (ver **DA-11**). Si el negocio prefiere contar Aprobado, documentarlo como decisión.

### Header (dtop)

1. **HD-01** · **Severidad:** Media
   - **Estático:** en `.hl` ("hoy"), `background: linear-gradient(transparent 52%, var(--lime) 52%, var(--lime) 92%, transparent 92%); padding: 0 2px` (518): un subrayado tipo resaltador en la mitad inferior, como en `01-dashboard.png`.
   - **Implementado:** `desk.css:54` pinta un bloque lima completo, con `border-radius: 6px; padding: 0 4px`.
   - **Cómo corregir:** `.hl { background: linear-gradient(transparent 52%, var(--lime) 52%, var(--lime) 92%, transparent 92%); padding: 0 2px; }` (sin `border-radius`).

2. **HD-02** · **Severidad:** Baja
   - **Estático:** el CTA `dcta('Registrar venta','new-venta')` (1610) muestra **`I.plus('#fff')`** como SVG (reducido a 16×16 por `.dbtn svg`, 765; path `M12 5v14M5 12h14`, stroke 2.1) más el texto "Registrar venta".
   - **Implementado:** `DashboardScreen.tsx:88` muestra el texto literal `"+ Registrar venta"`.
   - **Cómo corregir:** `<button className="dbtn p"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Registrar venta</button>`. Crear un `DeskCta` reutilizable para los dtop de todas las pantallas.

3. **HD-03** · **Severidad:** Baja
   - **Estático:** avatares del dtop (1620; *computado*):
     - 36×36, **círculo** (lo fija `.s-familia .av`), **14px/800**, `border: 2px solid #F7F8FA`, `margin-left: -8px`; el contenedor `.avatars` tiene `margin-right: 6px`.
     - Colores: `--c-blue`, `.a` = `--c-pink`, `.g` = `--c-green`.
     - Botón "+": fondo `#fff`, `border: 2px solid var(--bg)` (el dashed queda pisado), color `#6B7280`, 18px/**500**.
     - Se muestran **todos** los miembros.
   - **Implementado:** `DashboardScreen.tsx:82-86` y `desk.css:116-119`: 11px, colores `b/p/g/a` (`#F85582`, `#25A66A`, `#8B5CF6`), `slice(0, 4)`, "+" transparente con 1.5px dashed `#C9CDD4` en color primary. Si un miembro no tiene `displayName`, se usan las iniciales del **usuario actual** (`|| name`).
   - **Cómo corregir:**
     - `.av { font-size:14px }`.
     - `.av.add { background:#fff; border:2px solid var(--bg); color:#6B7280; font-weight:500; font-size:18px }`.
     - `.dright .avatars { margin-right:6px }`.
     - Colores por índice `['b','p','g']` con los `--c-*` (**GL-06**).
     - Fallback a `member.user.email`.
     - Mostrar todos los miembros, o mantener un tope documentado.

4. **HD-04** · **Severidad:** Baja
   - **Estático:** Notificaciones y Configuración se dibujan con `hdr()` dentro de `.dm`, no con `dtop`. `.whead` (487 + 810) es `display:flex; align-items:flex-start; gap:10px; padding:0 0 18px`. `.wt h1` mide 30px/800, `-0.02em`, `line-height 1.12`. `.wsub` mide **13px/500**, `margin-top: 3px` (*computado*). El link derecho queda **alineado arriba**, a la altura del h1 (ver `21-notificaciones.png`).
   - **Implementado:** `AccountScreens.tsx:42-48,119` usa `.dtop` (`align-items:flex-end`, `margin-bottom:22px`) y `.dsub` (14px/600, `mt 4`). "Leer todas" queda alineado abajo.
   - **Cómo corregir:** crear un componente `PageHead` para estas dos pantallas con clase `.whead` (`display:flex; align-items:flex-start; gap:10px; padding-bottom:18px`) y `.wsub { font-size:13px; font-weight:500; margin-top:3px; color:var(--secondary) }`.

5. **HD-05** · **Severidad:** Baja
   - **Estático:** el saludo es `'Hola, ' + state.me.name` (1619).
   - **Implementado:** `DashboardScreen.tsx:71` usa `displayName || 'equipo'`, lo que produce "Hola, equipo" (además, `DeskApp.tsx:36` usa como fallback el email).
   - **Cómo corregir:** usar el mismo `name` que la sidebar: `displayName?.trim() || email?.split('@')[0] || 'Usuario'`.

### Dashboard

1. **DA-01** · **Severidad:** Media
   - **Estático:** tarjeta "Flujo sugerido" (`.hero.dhero`, 1622; *computado*): fondo `#fff`, borde 1px `--border`, **`border-radius: 26px`**, **`padding: 16px 16px 14px`**, `box-shadow: var(--sh)`, `display:flex; flex-direction:column; height:100%`. Además: `.hero-top { margin-bottom:10px }`; `h2` 20px/800 con `letter-spacing: -0.01em` y `mb 2`; `.sub` 13px/**500**, `mb 10`.
   - **Implementado:** `desk.css:90-96`: radio 20, padding `18px 20px 16px`, sin sombra, `hero-top mb 8`, h2 sin `letter-spacing`, `.sub` 600 con `mb 8`.
   - **Cómo corregir:**
     ```css
     .hero { background:#fff; border:1px solid var(--border); border-radius:26px; padding:16px 16px 14px; box-shadow:var(--sh); display:flex; flex-direction:column; }
     .hero-top { margin-bottom:10px; }
     .hero h2 { letter-spacing:-0.01em; }
     .hero .sub { font-weight:500; margin-bottom:10px; }
     ```

2. **DA-02** · **Severidad:** Media
   - **Estático:** el badge dice **"+ Tu turno"** (1622). Estilo: `inline-flex; gap: 6px`, 12px/**700**, `padding: 5px 10px`, fondo `--lime-soft` (136+690).
   - **Implementado:** `DashboardScreen.tsx:95` dice "↑ Tu turno", y `desk.css:92` usa peso 800 sin `gap`.
   - **Cómo corregir:** texto `+ Tu turno`. CSS: `font-weight:700; gap:6px`.

3. **DA-03** · **Severidad:** Baja
   - **Estático:** checklist (*computado*):
     - `.hlist { margin:0 -4px; padding:0 4px }`.
     - `.item`: `padding: 9px 4px`, `gap: 12px`, `border-top: 1px solid var(--border)`; el primero sin borde.
     - `.cb`: **24×24**, borde 2px `#D1D5DB`, `transition: background .15s, border-color .15s`. `.cb.on`: fondo y borde `--ok`, con el ✓ dibujado por `::after` (`left:6px; top:3px; width:6px; height:10px; border-width:0 2.2px 2.2px 0`, en blanco).
     - `.name`: 15px/700. En `.done`: tachado, color `#9AA0AA`, **600**.
     - `.ring-inner`: **11px/800**.
   - **Implementado:** `desk.css:94,97-103`: `.item` con `padding 11px 2px`; `.cb` de 22×22 con ✓ `left 6, top 2, 5×9, 2px`; `.done` mantiene 700; `ring-inner` 12px; sin `.hlist` (los ítems cuelgan directo del hero).
   - **Cómo corregir:** copiar esos valores en `.item`, `.cb`, `.cb.on::after`, `.item.done .name { font-weight:600 }` y `.ring-inner { font-size:11px }`. Envolver los ítems en `<div className="hlist">`.

4. **DA-04** · **Severidad:** Baja
   - **Estático:** barra de progreso (*computado*): `.progress { margin: 8px 0 12px; font-size: 12px; font-weight: 600; gap: 10px }`. `.bar` mide **8px**, radio 4, fondo `#F0F1F3`, `margin: 8px 0 6px` (porque `.s-familia .bar` gana la cascada). El relleno es lima, con radio 4 y `transition: width .3s`.
   - **Implementado:** `desk.css:104-106`: `.progress` con `margin-top: 8px` y 700; `.bar` de 6px, radio 3, `#ECEDEF`; relleno sin radio ni transición.
   - **Cómo corregir:** `.progress { margin:8px 0 12px; font-weight:600 }`, `.bar { height:8px; border-radius:4px; background:var(--row) }`, `.bar i { border-radius:4px; transition: width .3s }`.

5. **DA-05** · **Severidad:** Media
   - **Estático:** al tildar el último ítem, `toast('¡Flujo del día completo!')` (1450).
   - **Implementado:** `toggle()` (`DashboardScreen.tsx:49-54`) no muestra ningún toast.
   - **Cómo corregir:** en `toggle`, si `TASKS.every(t => next[t.id])` y antes no estaban todos, llamar a `toast('¡Flujo del día completo!')` (`useDesk().toast`).

6. **DA-06** · **Severidad:** Media
   - **Estático:** el checklist se tilda solo con la actividad: `save-eq` y `do-import` (inventario) ponen `checks.inv = true` (1481, 1487); `save-venta` pone `checks.ven = true` (1497). La tarea 3 es manual.
   - **Implementado:** todo es manual, guardado en `localStorage` (`DashboardScreen.tsx:31-37,49-54`).
   - **Cómo corregir (con datos reales):** derivar `inv` de "hay algún producto creado o modificado hoy". Si `Product` no expone `createdAt/updatedAt`, marcarlo desde `addProduct`/import exitoso con el mismo `storageKey`. Derivar `ven` de "hay una venta con `parseAppDate(sale.date)` igual a hoy". Combinar: `checked = manual[id] || auto[id]`.

7. **DA-07** · **Severidad:** Media
   - **Estático:** tarjetas KPI `.mini.dk` (1617; *computado*):
     - Tarjeta: fondo `#fff`, borde 1px, **radio 22**, **`padding: 14px`**, `box-shadow: var(--sh)`; en hover `0 6px 20px rgba(22,24,29,.06)`; en `:active` `scale(.98)`.
     - `.ico`: 32×32, radio 10, fondo `#F0F1F3`, `mb 10`, SVG de **22px**.
     - `.eyebrow`: **10px/700**, `letter-spacing .06em`, mayúsculas, color **`#9AA0AA`**, `mb 4`.
     - `.val`: **20px/800**, `-0.02em`.
     - `.sub`: **12px/500**, `margin-top: 2px`.
   - **Implementado:** `desk.css:108-113`: radio 20, padding 16, sin sombra; eyebrow 11px/800/.04em en `--secondary` con `mb 6`; `val` **26px**; `sub` 13px/600 con `mt 4`; íconos lucide de 16px.
   - **Cómo corregir:**
     ```css
     .mini { border-radius:22px; padding:14px; box-shadow:var(--sh); transition:transform .12s; }
     .mini:active { transform:scale(.98); }
     .eyebrow { font-size:10px; font-weight:700; letter-spacing:.06em; color:var(--section); margin-bottom:4px; }
     .mini .val { font-size:20px; letter-spacing:-0.02em; }
     .mini .sub { font-size:12px; font-weight:500; margin-top:2px; }
     ```

8. **DA-08** · **Severidad:** Media
   - **Estático:** íconos de los KPI (1626-1629), de 22px en `#16181D`:
     - Ventas del mes: `I.vcart`.
     - **En stock: `I.box`**, que es un **celular** (`<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>`, como en `01-dashboard.png`).
     - **Canjes en curso: `I.swap`**.
     - Saldos a cobrar: `I.user`.
   - **Implementado:** `DashboardScreen.tsx:116,122,129,135` usa `ShoppingCart`, **`Box`** (caja 3D), **`RefreshCcw`** y `UserRound`, todos de 16px.
   - **Cómo corregir:** usar `DeskIcon` (ver **SH-01**) a 22px con los paths `vcart`, `box`, `swap` y `user`.

9. **DA-09** · **Severidad:** Media
   - **Estático:** el sub de "Ventas del mes" es `vm.n + ' ventas · <span class="up">▲ 12%</span>'` (1626). `.up` es `--ok`, 800 (*computado*: `rgb(37,166,106)`).
   - **Implementado:** `DashboardScreen.tsx:119` muestra solo `{n} ventas`, sin variación.
   - **Cómo corregir (con datos reales):** calcular `prevTotal` con las ventas no canceladas del mes anterior, hasta el mismo día del mes. `delta = prevTotal ? Math.round((monthTotal - prevTotal) / prevTotal * 100) : null`. Renderizar `{n} ventas · <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>` (`.down` ya existe en `desk.css:85`). Omitir la parte de la variación si no hay mes previo.

10. **DA-10** · **Severidad:** Baja
    - **Estático:** la regla pensada para la barra de "En stock" es `.mini.dk .budget { height:6px; margin-top:10px; background:#ECEDEF; border-radius:3px }` con **relleno lima** (838-839). *Computado:* por la cascada heredada de `.s-familia .budget` (`padding: 16px` y sombra), el prototipo dibuja una caja gris de 32px **sin relleno visible**, que es el rectángulo gris de `01-dashboard.png` (ver Dudas).
    - **Implementado:** `desk.css:114-115`: barra de 6px con relleno **`#D5D8DE`** (gris) y `margin-top: 12px`.
    - **Cómo corregir:** respetar la intención: `.budget { margin-top:10px } .budget i { background: var(--lime) }`. No replicar el artefacto de 32px, salvo que el dueño lo pida explícitamente.

11. **DA-11** · **Severidad:** Media
    - **Estático:** el KPI "Canjes en curso" y la tarjeta inferior "Canjes en curso" usan `open = Pendiente | Peritaje téc. | En revisión` (1616, 1628, 1631). Sub: `state.cj.length + ' en total'`.
    - **Implementado:** `DashboardScreen.tsx:67` usa `isOpenTrade` (`format.ts:163`), que **incluye `APROBADO`**, así que el número y la lista difieren.
    - **Cómo corregir:** usar el helper de **SH-06** en el KPI (línea 131) y en la lista (línea 168).

12. **DA-12** · **Severidad:** Media
    - **Estático:** "Ventas recientes" usa `veTable(state.ve.slice(0,5), true)` (1630, 1652-1657) con `dtable compact`: celdas `padding: 10px 12px`, primera columna `padding-left: 20px` (783-791; *computado*). La tabla **sangra hasta los bordes de la card**: `.dcard:not(.flush) .dtable.compact { margin: 0 -20px -18px; width: calc(100% + 40px) }`, con el encabezado `#FBFBFC` de borde a borde, como en `01-dashboard.png`. `.dch { margin-bottom:12px }`; la fecha va como `<small>` 12px/**500** con formato `05/10/2026`.
    - **Implementado:** `DashboardScreen.tsx:147` usa `className="dtable"` sin `compact` (padding 12/16), no sangra, `.dch { margin-bottom:8px }` (`desk.css:78`), `small` en 600, y la fecha cruda `sale.date` (puede venir como "05 oct 2026"). El orden es `sales.slice(0,5)` tal como lo entrega `AppContext`, sin ordenar.
    - **Cómo corregir:**
      - `className="dtable compact"`.
      - CSS: `.dtable.compact td, .dtable.compact th { padding:10px 12px } .dcard .dtable th:first-child, .dcard .dtable td:first-child { padding-left:20px } .dcard:not(.flush) .dtable.compact { margin:0 -20px -18px; width:calc(100% + 40px) } .dch { margin-bottom:12px } .dtable small { font-weight:500 }`.
      - Formatear la fecha con `parseAppDate(sale.date)?.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })`.
      - Ordenar por fecha (o `saleNumber`) descendente antes del `slice(0,5)`.

13. **DA-13** · **Severidad:** Media
    - **Estático:** cada canje se dibuja con `cjCard(c)` (1024-1028; *computado*):
      - Estructura: `.ticket > .wtop[.date "#C-0002 · 04/10/2026" + pill] + .store "Recibido: …" + .wbot[.items "Cliente<br>Entrega: …" | .wamt "$ 420.000"<small>"dif. $ 680.000"</small>]`. El importe queda **abajo a la derecha, alineado a la derecha**, con "dif." debajo y el texto del cliente a la izquierda.
      - Ticket: `padding 14px 16px`, radio 20, borde y `--sh`, `margin-bottom 10`.
      - `.date`: 12px/500. `.store`: 15px/800, `-0.01em`, `mb 6`. `.items`: 12px/500, `lh 1.45`. `.wamt`: 17px/800, `-0.02em`. `small`: 11px/600 en bloque.
      - El código es `C-NNNN`.
    - **Implementado:** `DashboardScreen.tsx:169-174` y `desk.css:150-156`: un layout tipo kanban (`.meta`, `.ttl` 14px, `.who` 12px/600, `.amt` con borde superior y el importe **a la izquierda**), padding `12px 14px`, radio 16, sin borde. El código es **`#${trade.id.slice(-4).toUpperCase()}`**.
    - **Cómo corregir:** replicar la estructura `wtop/store/wbot` con clases propias del dashboard (para no pisar el kanban de Canjes):
      ```tsx
      <button className="ticket dash-cj" onClick={…}>
        <div className="wtop"><span className="date">#{tradeCode(tradeIns, t.id)} · {fmtDate(t.date)}</span><Pill status={t.status} /></div>
        <div className="store">Recibido: {t.deviceReceived}</div>
        <div className="wbot"><div className="items">{clientName(clients, t.clientId)}<br />Entrega: {t.deviceGiven}</div>
          <div className="wamt">{formatMoney(t.takeValue)}<small>dif. {formatMoney(t.differencePaid)}</small></div></div>
      </button>
      ```
      CSS: `.wtop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px} .ticket .date{font-size:12px;color:var(--secondary);font-weight:500} .ticket .store{font-size:15px;font-weight:800;letter-spacing:-.01em;margin-bottom:6px} .wbot{display:flex;align-items:flex-end;justify-content:space-between;gap:10px} .ticket .items{font-size:12px;color:var(--secondary);font-weight:500;line-height:1.45} .wamt{font-size:17px;font-weight:800;letter-spacing:-.02em;text-align:right;white-space:nowrap} .wamt small{display:block;font-size:11px;font-weight:600;color:var(--secondary);letter-spacing:0}`. Ticket: `padding:14px 16px; border-radius:20px; border:1px solid var(--border); box-shadow:var(--sh)`.

14. **DA-14** · **Severidad:** Media
    - **Estático:** en el Dashboard, las filas de "Ventas recientes" (`data-act="ve"`) y los tickets de canje (`data-act="cj"`) tienen `data-id`, así que también abren el menú Editar/Eliminar con clic derecho o long-press (`LP_ACTS`, 1416).
    - **Implementado:** `DashboardScreen.tsx:153,169` solo tiene `onClick`.
    - **Cómo corregir:** agregar `onContextMenu` y el `useLongPress` de **GL-13** con los mismos labels que `SalesScreen.tsx:88` (`${saleCode(sale)} · ${cliente}`) y `TradeInsScreen.tsx:70`.

15. **DA-15** · **Severidad:** Baja
    - **Estático:** si no hay ventas, `veTable` muestra `"No encontré ventas."` (1653).
    - **Implementado:** `DashboardScreen.tsx:146` muestra `"Todavía no hay ventas."`.
    - **Cómo corregir:** usar el texto exacto `No encontré ventas.`.

### Notificaciones

1. **NO-01** · **Severidad:** Media
   - **Estático:** cada notificación tiene `{ t, s, when, unread, to }` (970-975), con títulos y formatos fijos:
     - "Nuevo canje pendiente" · `C-0004 · Cliente Ejemplo D` (se crea en `save-cj`, 1511).
     - "Venta registrada" · `V-0001 · $ 650.000` (se crea en `save-venta`, 1497).
     - "Equipo en revisión" · `iPhone 14 Pro · 256GB`.
     - "Socio Ejemplo se unió" · `Ahora es parte del equipo`.

     `when` es **relativo**: `hace 10 min`, `hace 1 h`, `ayer`, `02 oct`, `recién`. Orden: la más nueva primero.
   - **Implementado:** `buildNotes` (`AccountScreens.tsx:74-95`) genera "Canje en curso" (`cliente · equipo`), "Venta pendiente" (solo nombre), "Equipo en revisión" (`modelo capacidad`, sin `·`) y "Saldo pendiente". `when` puede ser `trade.date`, `sale.date`, **`'en stock'`** o **`'clientes'`**, que no son tiempos. No hay "Venta registrada" ni "se unió", y el orden es por tipo, no por fecha.
   - **Cómo corregir (con datos reales):**
     - "Nuevo canje pendiente": canjes con `PENDIENTE`, sub `${tradeCode(tradeIns,id)} · ${cliente}`.
     - "Venta registrada": ventas de los últimos 7 días, sub `${saleCode(sale)} · ${formatMoney(amount)}`.
     - "Equipo en revisión": `EN_REVISION`, sub `${model} · ${capacity}`.
     - "X se unió": `listMembers()` expone `createdAt` (`members-api.ts:12`), sub `Ahora es parte del equipo`.

     Calcular `when` con un helper `relTime(date)` que devuelva `recién` / `hace N min` / `hace N h` / `ayer` / `dd mmm`, y ordenar por fecha descendente. "Saldo pendiente" puede quedar como extra, pero con un `when` temporal o vacío, nunca `'clientes'`.

2. **NO-02** · **Severidad:** Media
   - **Estático:** el subtítulo es `u ? u + ' sin leer' : 'Todo al día'`. El botón **"Leer todas" solo aparece si `u > 0`** (1161).
   - **Implementado:** `AccountScreens.tsx:45-47` muestra `{n || 'Nada'} sin leer` (resultado: "Nada sin leer") y el botón siempre.
   - **Cómo corregir:** `{unread ? `${unread} sin leer` : 'Todo al día'}` y `{unread > 0 && <button className="wlink" …>Leer todas</button>}`.

3. **NO-03** · **Severidad:** Baja
   - **Estático:** al leer todas, `toast('Todo leído')` (1547).
   - **Implementado:** `AccountScreens.tsx:37` muestra `toast('Listo')`.
   - **Cómo corregir:** usar `'Todo leído'`.

4. **NO-04** · **Severidad:** Media
   - **Estático:** fila (1163; *computado*):
     - `.member` con `padding: 14px; gap: 12px`.
     - `.ico-row`: 40×40, **radio 12**, fondo **`--lime-soft` si no está leída** (`.ico-row.l`) o `#F0F1F3` si ya se leyó.
     - Ícono campana **sin badajo**: `sv('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/>', '#16181D', 18)`.
     - `.name` 15px/700; `.role` 12px/**500**, `mt 2`, con formato `s · when`.
   - **Implementado:** `AccountScreens.tsx:55-56`: `.dthumb` de 36×36, radio 10, siempre `#F3F4F6`, lucide `Bell` de 16; `.name` 14px (`desk.css:168`), `.role` 600.
   - **Cómo corregir:** `<div className={`ico-row${unread ? ' l' : ''}`}><DeskIcon size={18} d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /></div>`. CSS: `.ico-row{width:40px;height:40px;border-radius:12px;background:var(--row);display:flex;align-items:center;justify-content:center;flex-shrink:0} .ico-row.l{background:var(--lime-soft)}`, más `.member .info .name{font-size:15px;font-weight:700}` y `.member .role{font-weight:500}`.

5. **NO-05** · **Severidad:** Baja
   - **Estático:** a la derecha va el punto `.unread` de 9×9 en `#16181D` si no está leída, o **un chevron `›`** (`.chev` 20px/800, color `#9AA0AA`) si ya se leyó.
   - **Implementado:** `AccountScreens.tsx:57` muestra un punto de 8×8 (`desk.css:246`) y nada cuando está leída.
   - **Cómo corregir:** `{unread ? <span className="unread" /> : <span className="chev">›</span>}`. CSS: `.unread{width:9px;height:9px} .chev{color:var(--section);font-size:20px;font-weight:800}`.

6. **NO-06** · **Severidad:** Media
   - **Estático:** el contenedor es `.card` (`.s-familia .card`): **sin padding**, radio 22, borde, `--sh`, `overflow:hidden`. El `.content` mide **`max-width: 860px`** (837; *computado*: card de 860px). Las filas separan con `border-bottom: 1px solid var(--border)`, salvo la última.
   - **Implementado:** `AccountScreens.tsx:52` usa `.dcard` (`padding 18px 20px`, radio 20, sin sombra) con `maxWidth: 760`. Las filas tienen `padding 14px 4px` y borde `#F0F1F3` (`desk.css:165`).
   - **Cómo corregir:** crear `.card { background:#fff; border:1px solid var(--border); border-radius:22px; overflow:hidden; box-shadow:var(--sh) }` y `.card .member { padding:14px; border-bottom:1px solid var(--border) } .card .member:last-child { border-bottom:0 }`. Usarla con `maxWidth: 860`. Lo mismo aplica a Configuración (**CF-02**).

7. **NO-07** · **Severidad:** Baja
   - **Estático:** los chips "Todas" / "Sin leer" van en `.wchips` con `padding: 0 20px 12px` y `max-width: 760px` (500, 815). Quedan **sangrados 20px** respecto de la card, como en `21-notificaciones.png`. Entre chips y card hay 12px.
   - **Implementado:** `AccountScreens.tsx:49-51` los pone dentro de `.dbar` (sin sangría, `margin-bottom: 16px`).
   - **Cómo corregir:** renderizar `ChipRow` en un wrapper `<div style={{ padding: '0 20px 12px', maxWidth: 760 }}>` (o crear la clase `.wchips.pad`).

8. **NO-08** · **Severidad:** Baja
   - **Estático:** si la lista queda vacía, se muestra `.wempty` **fuera** de cualquier card con el texto `"Estás al día. No hay notificaciones sin leer."` (1163; *computado*).
   - **Implementado:** `AccountScreens.tsx:53` pone `"Estás al día."` dentro de la `.dcard`.
   - **Cómo corregir:** si `visible.length === 0`, renderizar solo `<div className="wempty">Estás al día. No hay notificaciones sin leer.</div>`, sin card.

### Configuración

1. **CF-01** · **Severidad:** Media
   - **Estático:** `.dconf .content { display:block; max-width:860px }` (836). Los bloques van en flujo normal: el encabezado de sección `.wsec` lleva `margin: 6px 4px 8px` y la card no tiene margen (ver `20-configuracion.png`, con TIENDA pegado a su card). `.wsec > span` mide **11px/700**, `letter-spacing .08em`, mayúsculas, color **`#9AA0AA`** (*computado*).
   - **Implementado:** `.settings-grid` (`desk.css:170`) es un `display:grid; gap:18px` que agrega 18px entre cada etiqueta y su card. `.sec` (`desk.css:171`) mide 12px/800, `.04em`, en `--secondary`, con `margin: 8px 2px`.
   - **Cómo corregir:** `.settings-grid { display:block; max-width:860px }` y `.sec { display:flex; justify-content:space-between; align-items:baseline; margin:6px 4px 8px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--section) }`.

2. **CF-02** · **Severidad:** Media
   - **Estático:** las tarjetas son `.card` flush (radio 22, sin padding, `--sh`) y las filas `.member` tienen `padding: 14px`.
   - **Implementado:** `AccountScreens.tsx:124,131,153` usa `.dcard` (padding 18/20), así que las filas quedan con doble sangría y el divisor no llega al borde.
   - **Cómo corregir:** usar la `.card` de **NO-06**.

3. **CF-03** · **Severidad:** Media
   - **Estático:** filas `mrow(ico, t, s, act, to, right)` (1130-1132): `.ico-row` de 40×40 (radio 12, `#F0F1F3`) con ícono de 18px (`I.store`, `I.user`, `I.lock`, `I.card`), `.info` (`.name` 15px/700, `.role` 12px/500), opcionalmente `.rtxt` (12px/700, `--secondary`) y **siempre el chevron `›`** a la derecha (ver `20-configuracion.png`).
     - `I.store`: `<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>`.
     - `I.lock`: `<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>`.
     - `I.card`: `<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/>`.
   - **Implementado:** `AccountScreens.tsx:125-128,154-161` usa `.dthumb` de 36 con lucide de 16 (`Store`, `UserRound`, `Lock`) y no tiene chevrons.
   - **Cómo corregir:** crear `MRow({ icon, title, sub, right, onClick })` en `AccountScreens.tsx`:
     ```tsx
     <button className="member" onClick={onClick}><div className="ico-row">{icon}</div>
       <div className="info"><div className="name">{title}</div><div className="role">{sub}</div></div>
       {right ? <span className="rtxt">{right}</span> : null}<span className="chev">›</span></button>
     ```
     CSS: `.rtxt{font-size:12px;font-weight:700;color:var(--secondary);white-space:nowrap}`.

4. **CF-04** · **Severidad:** Baja
   - **Estático:** sub de la fila Tienda: `'Nombre y configuración regional'` (1150).
   - **Implementado:** `AccountScreens.tsx:127` dice `'Nombre, CUIT y moneda'`.
   - **Cómo corregir:** usar el texto exacto del estático.

5. **CF-05** · **Severidad:** Media
   - **Estático:** la sección Equipo lleva a la derecha el conteo `'<span>' + state.team.length + ' miembros</span>'` (1151; *computado*: 12px/600, `#9AA0AA`, sin mayúsculas).
   - **Implementado:** `AccountScreens.tsx:130` muestra solo "Equipo".
   - **Cómo corregir:** `<div className="sec"><span>Equipo</span><span className="secr">{members.length} miembros</span></div>` con `.secr{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none}`.

6. **CF-06** · **Severidad:** Media
   - **Estático:** filas de miembros (1152), como en `20-configuracion.png`:
     - Avatar `.av-c` de 40px con el color propio de cada miembro (`b`, `p`, `g`).
     - Para el usuario actual, una pill **`vos`** (`spill mid`) antes del rol.
     - Rol: **`spill off`** (negra) para Propietario y `spill mid` para Socio y Agente.
   - **Implementado:** `AccountScreens.tsx:132-140`: todos con `av-c b` (azul), sin "vos", y todos los roles en `spill mid`.
   - **Cómo corregir:** `className={`av-c ${['b','p','g'][i % 3]}`}`. Agregar `{member.userId === appSession?.user.id && <span className="spill mid">vos</span>}` y `<span className={`spill ${member.role === 'OWNER' ? 'off' : 'mid'}`}>`. Para que el negro salga bien, `.spill.off` tiene que estar corregido (**GL-07**). Agregar también `gap` entre las pills (el `.member` ya tiene `gap: 12px`; en el estático, la distancia "vos" → rol es la misma).

7. **CF-07** · **Severidad:** Media
   - **Estático:** las invitaciones activas se resumen en **una sola fila** clicable (1153): título `N links de invitación activos` (o `1 link de invitación activo`), sub `Agente · expira 12 oct · Socio · expira 14 oct` y chevron. Al hacer clic se abre el sheet **"Links de invitación"** (1348), con sub `Cada link sirve una sola vez y vence solo.`, filas `.kv` (`url<br><small>Rol · un solo uso · vence 12 oct</small>` + botón `.mbtn` "Cancelar"), el vacío `No quedan invitaciones.` y el botón `Listo` (`sacts one`, `btn2 s`). Al cancelar: `toast('Invitación cancelada')` y se rerenderiza. `.mbtn` mide 34px de alto, radio 999, 12px/700, borde 1.5px `--border` (663).
   - **Implementado:** `AccountScreens.tsx:142-147` dibuja una fila por invitación (`Invitación Agente` / `Vence 12/10/2026`) con un `wlink` "Cancelar" inline, sin toast ni manejo de error (la promesa rechazada queda sin capturar). Además, después de generar un link en `InviteForm`, la lista **no se recarga** (`load` no se vuelve a llamar).
   - **Cómo corregir:**
     - Reemplazar el `map` por una fila resumen con el formato exacto. Para la fecha: `new Date(expiresAt).toLocaleDateString('es-AR', { day:'2-digit', month:'short' }).replace('.', '')`, que da `12 oct`.
     - Agregar `Overlay { type: 'invites' }` en `types.ts` y un sheet `InvitesList` en `DeskOverlays.tsx` que liste, revoque (con `toast('Invitación cancelada')` y error visible) y vuelva a cargar.
     - Exponer un `reloadInvites` (por ejemplo, vía evento o callback en el overlay) para refrescar la lista después de `createInvitation`.

8. **CF-08** · **Severidad:** Media
   - **Estático:** "Mi cuenta" tiene tres filas: Perfil (`nombre · email`), Seguridad (`Cambiar contraseña`) y **Facturación** (`I.card`, sub `Usuario Beta`, texto derecho `Acceso anticipado`; al hacer clic, `toast('Plan Pro activo hasta el 05/11')`, 1155, 1564).
   - **Implementado:** `AccountScreens.tsx:162-165` reemplaza Facturación por una fila "Rol" (`store?.name` + pill de rol) que no existe en el estático.
   - **Cómo corregir:** quitar la fila "Rol" y agregar `MRow` Facturación con `title="Facturación" sub="Usuario Beta" right="Acceso anticipado"`. Hoy no hay billing en el backend, así que el texto queda fijo. El toast del estático ("Plan Pro activo hasta el 05/11") contradice "Usuario Beta"; ver Dudas.

9. **CF-09** · **Severidad:** Media
   - **Estático:** "Cerrar sesión" va dentro de un contenedor `.logout`: tarjeta blanca con `border-radius: 22px; padding: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.08); margin-top: 8px` (278 + 658; *computado*). Adentro hay un botón **pill**: `height: 52px; border-radius: 999px; background: #fff; border: 1.5px solid var(--border)`, 15px/700 (659 + 688). Ver `20-configuracion.png`.
   - **Implementado:** `desk.css:173-174`: `.logout` sin tarjeta; el botón mide 48px de alto, radio 14, borde 1px, peso 800.
   - **Cómo corregir:** `.logout { margin-top:8px; background:#fff; border-radius:22px; padding:12px; box-shadow:0 4px 16px rgba(0,0,0,.08) }` y `.logout button { width:100%; height:52px; border-radius:999px; background:#fff; border:1.5px solid var(--border); font-size:15px; font-weight:700 }`.

10. **CF-10** · **Severidad:** Alta
    - **Estático:** "Cerrar sesión" abre `dialog('¿Cerrar sesión?', …, 'Cerrar sesión', 'logout-ok')` (1356, 1565). Solo al confirmar se cierra la sesión y se navega a `#/salida`.
    - **Implementado:** `AccountScreens.tsx:167` llama a `logout()` directo, sin confirmación. El overlay `{ type: 'logout' }` existe (`types.ts:31`, `DeskOverlays.tsx:102-108`), pero **nadie lo abre**.
    - **Cómo corregir:** `onClick={() => open({ type: 'logout' })}`, y renderizar ese overlay con el `Dialog` de **MG-01** (copy y color en **SA-02**).

11. **CF-11** · **Severidad:** Baja
    - **Estático:** sheet "Datos de la tienda" **sin subtítulo** (1350), con los campos `Nombre`, `CUIT`, `Dirección` (fld) y `Moneda` (sel ARS/USD), y los botones `Cancelar` / `Guardar`. Valida que `name` no esté vacío, inline (`need(['name'])`, 1556). Toast: `Tienda actualizada`.
    - **Implementado:** `DeskOverlays.tsx:461-486` agrega el campo **Teléfono** (que es un dato real del backend), y la validación es un banner global (ver **MG-05**).
    - **Cómo corregir:** se puede mantener Teléfono como extra (decisión de producto) o quitarlo para respetar la pantalla. Validar inline el nombre con "Completá este dato".

12. **CF-12** · **Severidad:** Media
    - **Estático:** sheet "Perfil" **sin subtítulo** (1352), con los campos `Nombre`, `Email` (type `email`) y `Teléfono` (type `tel`). Valida nombre y email (1557). Toast: `Perfil actualizado`.
    - **Implementado:** `DeskOverlays.tsx:488-502` solo tiene `Nombre`, con el email como subtítulo. `updateUserProfile` solo acepta `{ displayName }` (`AppContext.tsx:71`).
    - **Cómo corregir:** quitar el subtítulo y mostrar `Email` como `Field` con `<input type="email" value={email} disabled />` (solo lectura, porque el email lo maneja Firebase). Teléfono se puede agregar si el backend suma `phone` a `User`; si no, omitirlo y anotarlo como dato faltante.

13. **CF-13** · **Severidad:** Baja
    - **Estático:** en "Cambiar contraseña" (1354, 1558-1563), los errores van **en el campo**: vacíos con `Completá este dato`; `p1.length < 8` con **`Mínimo 8 caracteres`** en "Nueva contraseña"; `p1 !== p2` con **`No coinciden`** en "Repetir nueva". Toast: `Contraseña actualizada`.
    - **Implementado:** `DeskOverlays.tsx:520-529` muestra banners globales `Mínimo 8 caracteres.` / `Las contraseñas no coinciden.`, y no valida que la contraseña actual esté completa. La variante para cuentas de Google (`DeskOverlays.tsx:511-513`) es un extra aceptable por datos reales, pero su botón queda suelto, fuera de `sacts one`.
    - **Cómo corregir:** errores por campo con **MG-05**, con los textos exactos sin punto final. Envolver el botón "Entendido" en `<div className="sacts one">`.

14. **CF-14** · **Severidad:** Media
    - **Estático:** paso 1, sheet "Invitar al equipo" (1345-1346):
      - Sub: `Generá un link de un solo uso para sumar a alguien a {tienda}.`
      - Rol con `sgs` Agente/Socio y `.sheet-note` (12px/500, `#9AA0AA`, `margin-top: 10px`, alineado a la izquierda): `El Agente carga equipos y ventas. El Socio además ve reportes y aprueba canjes.`
      - Botones: `Cancelar` / `Generar link`.

      Paso 2, "Link listo" (1341-1344):
      - Sub: `Pasáselo a quien quieras sumar como {Rol}. Sirve para una sola persona y vence el {12 oct}.`
      - `.linkrow` (73-75, *computado*): fondo `#F0F1F3`, **borde 1.5px dashed `--border`**, radio 16, `padding: 8px 8px 8px 14px`, `mb 12`. El `span` mide 14px/700. El botón "Copiar" es un **pill lima** de 40px de alto, `padding: 0 18px`, 14px/800.
      - Nota: `Cuando alguien entra con el link, deja de funcionar. Lo podés cancelar desde Configuración.`
      - Botones: `Listo` (`btn2 s`) y **`Compartir link`** (`btn2 p`). Usa `navigator.share` y, si no está disponible, copia y muestra `toast('Link copiado')` (1456-1459).

      No hay toast al generar el link.
    - **Implementado:** `DeskOverlays.tsx:533-564`:
      - Subs `Generá un link para sumar a alguien a la tienda.` y `El link es de un solo uso.`
      - Sin las notas.
      - `linkrow` sin borde dashed, con radio 12 (`desk.css:244-245`) y un "Copiar" `dbtn s` blanco.
      - Solo el botón `Listo` (`btn2 p`), sin "Compartir link".
      - Muestra un toast extra `Link generado`.
    - **Cómo corregir:**
      - Subtítulos y notas con los textos exactos. Nombre de la tienda: `appSession.store.name`. Rol: `role === 'STAFF' ? 'Agente' : 'Socio'`. Fecha: `created.expiresAt` en formato `dd mmm`.
      - CSS: `.sheet-note{font-size:12px;color:var(--section);font-weight:500;margin-top:10px}`, `.linkrow{border:1.5px dashed var(--border);border-radius:16px;padding:8px 8px 8px 14px;margin-bottom:12px;gap:10px} .linkrow span{font-size:14px} .linkrow button{height:40px;padding:0 18px;border-radius:999px;background:var(--lime);font-size:14px;font-weight:800}`.
      - Acciones: `<Actions secondary="Listo" onSecondary={close} primary="Compartir link" onPrimary={share} />`.
      - Quitar `toast('Link generado')`.

### Modales genéricos

1. **MG-01** · **Severidad:** Alta
   - **Estático:** `dialog(t, p, ok, act, id, danger)` (1009-1011) es un **diálogo compacto centrado** y distinto del sheet (*computado*):
     - Overlay `.ov.center` con `padding: 28px`, fondo `rgba(17,17,17,.45)` y `fadeIn .18s`.
     - `.dialog`: `max-width: 340px`, radio **26**, `padding: 24px 20px 18px`, **`text-align: center`**, sombra `0 20px 60px rgba(0,0,0,.4)`, animación `pop .2s cubic-bezier(.2,.8,.2,1)`.
     - `h3` 20px/800 con `mb 8`; `p` 14px/500 en `--secondary`, `lh 1.45`, `mb 20`.
     - `.row`: grid de dos columnas iguales con `gap 10`. Botones de 48px, radio 999, 14px/700. `.cancel` en `--row`; `.ok` en `#16181D` (o `--err` con `.danger`).

     Se usa para eliminar (1266-1267) y para cerrar sesión (1356). Ver la captura del diálogo de logout.
   - **Implementado:** no existe un primitivo `Dialog`; eliminar y cerrar sesión usan `Sheet` (540px, alineado a la izquierda) más `Actions` (`DeskOverlays.tsx:102-122`).
   - **Cómo corregir:** agregar en `ui.tsx`:
     ```tsx
     export function Dialog({ title, text, ok, onOk, onClose, danger, busy }: {…}) {
       useEscape(onClose);
       return <div className="ov center" onMouseDown={onClose}><div className="dialog" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
         <h3>{title}</h3><p>{text}</p>
         <div className="row"><button type="button" className="cancel" onClick={onClose} disabled={busy}>Cancelar</button>
           <button type="button" className={`ok${danger ? ' danger' : ''}`} onClick={onOk} disabled={busy}>{ok}</button></div></div></div>;
     }
     ```
     CSS: copiar las líneas 85-91, 477, 478 y 706 (`.dialog`, `.dialog h3`, `.dialog p`, `.dialog .row`, `.dialog .row button`, `.dialog .cancel`, `.dialog .ok`, `.dialog .ok.danger { background: var(--err) }`), más `.ov.center { padding:28px }`.

2. **MG-02** · **Severidad:** Alta
   - **Estático:** `.btn2` (581-583 + 707; *computado*) mide **52px de alto, `border-radius: 999px`** (pill), 15px/**700**, `display:flex; gap:8px`. `.p` usa `#16181D` con texto blanco y **`box-shadow: 0 6px 18px rgba(0,0,0,.18)`**. `.s` usa `#F0F1F3` con **`border: 1.5px solid var(--border)`**. `.l` usa fondo lima. Todos los sheets usan estos pills.
   - **Implementado:** `.btn2` (`desk.css:219-222`) mide 46px, **radio 12**, 14px/800, sin sombra en `.p` y sin borde en `.s`. El rectángulo redondeado se ve distinto a simple vista en todos los modales.
   - **Cómo corregir:** `.btn2{height:52px;border-radius:999px;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px} .btn2.p{background:#16181D;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.18)} .btn2.s{background:var(--row);color:#16181D;border:1.5px solid var(--border)} .btn2.l{background:var(--lime);color:#16181D} .btn2:disabled{opacity:.55}`. Conservar `.btn2.danger` con `--err` y la misma forma.

3. **MG-03** · **Severidad:** Media
   - **Estático:** la etiqueta de campo `.fl > span` (616; *computado*) mide **11px/700**, `letter-spacing .06em`, **mayúsculas**, color **`#9AA0AA`**, `mb 6`.
   - **Implementado:** `.fl span` (`desk.css:209`) mide 12px/800, sin mayúsculas, en color primary. Además, el selector es descendiente (`.fl span`), no hijo directo.
   - **Cómo corregir:** `.fl > span { display:block; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--section); margin-bottom:6px }`.

4. **MG-04** · **Severidad:** Media
   - **Estático:** `.fl input, .fl select` (617-618 + 702-703; *computado*) miden **48px**, radio **14**, borde 1.5px `--border`, fondo **`#F0F1F3`**, `padding: 0 14px`, **15px/600**, `appearance: none`. En foco: borde `--primary` y fondo `#fff`.
   - **Implementado:** `desk.css:210-211` usa 42px, radio 12, `padding 0 12px`, 14px y fondo `#F7F8FA` (por el `--row` incorrecto).
   - **Cómo corregir:** `height:48px; border-radius:14px; padding:0 14px; font-size:15px; font-weight:600; -webkit-appearance:none; appearance:none;` y corregir `--row` (**GL-04**).

5. **MG-05** · **Severidad:** Media
   - **Estático:** la validación es **por campo**. `fld()` incluye `<div class="err">Completá este dato</div>` (999), oculto por defecto. `need(names)` le pone `.bad` a cada campo vacío (1004-1008). `.fl.bad input/select`: borde `--err`, fondo `#fff`, `box-shadow: 0 0 0 3px var(--err-soft)`. `.fl.bad .err` se muestra con 12px/700 en `--err` y `mt 4` (619-621 + 704-705; *computado*). Al escribir, el estado `.bad` se quita (1578). Algunos mensajes reemplazan el texto (`El IMEI tiene 15 dígitos`, `Mínimo 8 caracteres`, `No coinciden`).
   - **Implementado:** los formularios tiran `Error` y se muestra un único banner `.err` arriba (`DeskOverlays.tsx:88-100`, `desk.css:233`), con mensajes como "Completá modelo, color e IMEI." No se marca ningún campo.
   - **Cómo corregir:** `Field({ label, error, children })` con `className={`fl${error ? ' bad' : ''}`}` y `{error ? <div className="err">{error}</div> : null}`. En cada formulario, usar un estado `errors: Record<string,string>` que se completa antes de llamar a `run`, y limpiar la clave en el `onChange`. Renombrar el banner global de error de backend a `.ferr` (13px/700 `--err`) para no chocar con `.fl .err` (que tiene `display:none` salvo con `.bad`). Los errores de persistencia siguen como banner y **no cierran el modal** (regla del repo).

6. **MG-06** · **Severidad:** Media
   - **Estático:** el overlay usa fondo **`rgba(17,17,17,.45)`** (475) con `animation: fadeIn .18s ease-out`. El sheet desktop entra con **`pop .2s cubic-bezier(.2,.8,.2,1)`** (`from { transform: scale(.94); opacity: 0 }`, 67, 824).
   - **Implementado:** `.ov` (`desk.css:204`) usa `rgba(22,24,29,.28)`, más claro, y ni el overlay ni el sheet tienen animación.
   - **Cómo corregir:** `.ov { background: rgba(17,17,17,.45); animation: fadeIn .18s ease-out }` y `.sheet { animation: pop .2s cubic-bezier(.2,.8,.2,1) }`, con los keyframes `fadeIn` y `pop` de las líneas 65 y 67.

7. **MG-07** · **Severidad:** Baja
   - **Estático:** en `#ovroot .sheet-ov` (824 + 613-614): `padding: 26px 28px 24px`, `max-width: calc(100vw - 48px)`, **scrollbar oculta** (`scrollbar-width: none`). `h3` mide 22px/800 con `letter-spacing: -0.01em` y `mb 6`. `.sub` mide 14px/**500** con `line-height: 1.4` y `mb 16` (71-72; *computado*).
   - **Implementado:** `.sheet` (`desk.css:205-207`) usa `padding-bottom: 22px`, scrollbar visible, `h3` sin `letter-spacing` y `.sub` en 600 sin `line-height`.
   - **Cómo corregir:** `.sheet{padding:26px 28px 24px;scrollbar-width:none} .sheet::-webkit-scrollbar{display:none} .sheet h3{letter-spacing:-0.01em;margin-bottom:6px} .sheet .sub{font-weight:500;line-height:1.4;margin:0 0 16px}`.

8. **MG-08** · **Severidad:** Baja
   - **Estático:** `acts(ok, act, cancel)` (998) arma `.sacts`: grid **`1fr 1.5fr`**, `gap 10`, **`margin-top: 16px`** (626).
   - **Implementado:** `desk.css:217` usa `1fr 1.4fr` con `margin-top: 8px`.
   - **Cómo corregir:** `grid-template-columns: 1fr 1.5fr; margin-top: 16px`.

9. **MG-09** · **Severidad:** Baja
   - **Estático:** segmentos `.sg` (624-625): **38px**, `padding: 0 14px`, radio 999, borde 1.5px `--border`, 13px/700. Para estados (`.sgs.stg`, 847-849, 882-883): `gap: 6px`, `padding: 0 11px`, y el punto `i.sd` de 8×8 con `margin-right: 7px` y `box-shadow: 0 0 0 1.5px rgba(255,255,255,.7)`. Al final va el botón lápiz `.sg-edit` (34px, dashed), que abre el submodal de estados. Ese submodal está fuera de este alcance (ver la auditoría de Inventario/Ventas/Canjes). Después de varios `sgs`, se inserta un espaciador `<div style="height:12px">`.
   - **Implementado:** `.sg` (`desk.css:214-216`) mide 36px con `padding 0 12px`, el punto no tiene `box-shadow`, y `.sgs` siempre lleva `margin-bottom: 12px`.
   - **Cómo corregir:** `.sg{height:38px;padding:0 14px}`, `.sgs.stg{gap:6px} .sgs.stg .sg{padding:0 11px} .sg i{margin-right:7px;box-shadow:0 0 0 1.5px rgba(255,255,255,.7)}` (con `gap:0` en `.sg` cuando hay punto, para no sumar los 6px de `gap`).

10. **MG-10** · **Severidad:** Baja
    - **Estático:** los `select` usan `appearance: none` (617), así que no muestran flecha nativa.
    - **Implementado:** el `select` de React muestra la flecha del sistema.
    - **Cómo corregir:** se incluye en **MG-04** (`appearance:none`).

11. **MG-11** · **Severidad:** Media
    - **Estático:** menú contextual (1262-1265 + 717-723 + 827-828):
      - Overlay `.ov.ctxov` con fondo **`rgba(22,24,29,.08)`**.
      - `.popmenu.ctxm`: `position: fixed`, **220px**, radio **18**, `padding: 6px`, sombra `0 14px 40px rgba(0,0,0,.18)`, borde 1px, animación `pop .16s ease-out` desde arriba a la derecha.
      - `.ctxh`: 12px/700 en `--secondary`, `padding: 10px 12px 8px`, borde inferior.
      - Botones con **ícono**: `I.edit()` de 18px y `Editar`; `I.trash()` de 18px en `#DC4C4C` y `Eliminar` en `--err`. `padding: 13px 12px`, 14px/700, `gap: 10px`, separados por `border-top`.
    - **Implementado:** `DeskOverlays.tsx:68-80` y `desk.css:234-238`: fondo transparente, 210px, radio 16, botones sin íconos (`padding 11px 10px`), sin animación ni separadores.
    - **Cómo corregir:** agregar los SVG (`edit`: `<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>`; `trash`: `<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>`, en `#DC4C4C`) y ajustar el CSS: `.ctx{width:220px;border-radius:18px;animation:pop .16s ease-out;transform-origin:top right} .ctx .ctxh{padding:10px 12px 8px} .ctx button{padding:13px 12px;gap:10px} .ctx button + button{border-top:1px solid var(--border)}`. Overlay: `background: rgba(22,24,29,.08)`. Posición según **GL-13**.

12. **MG-12** · **Severidad:** Media
    - **Estático:** el diálogo de eliminar usa `'¿Eliminar ' + c.what + '?'`, con `c.what` = `este equipo` / `esta venta` / `este canje` / `este cliente`. El texto es `"{nombre} se va a borrar y no se puede deshacer."` y el botón `Eliminar` (`danger`, rojo). Toasts: `Equipo eliminado` / `Venta eliminada` / `Canje eliminado` / `Cliente eliminado` (1238-1241, 1266-1267, 1526).
    - **Implementado:** `DeskOverlays.tsx:112-119` usa `¿Eliminar?` y `"{label} se borra y no se puede deshacer."`, con el toast genérico `Eliminado`.
    - **Cómo corregir:** usar el `Dialog` de **MG-01** con `danger`, con el mapa `{ eq: ['este equipo','Equipo eliminado'], sale: ['esta venta','Venta eliminada'], cj: ['este canje','Canje eliminado'], cl: ['este cliente','Cliente eliminado'] }` y los textos exactos.

### Salida

1. **SA-01** · **Severidad:** Alta
   - **Estático:** al confirmar el logout, `state.loggedOut = true` y se navega a `#/salida` con la animación `f` (1566). `sOut()` (1166-1170) dibuja, centrado en el stage (`body.out .stage { display:flex; align-items:center; justify-content:center }`, 830-831; `.s-out` en 346 con `padding: 0 30px 60px` y texto centrado):
     - Logo `.logo` de 84×84, radio 26, lima, sombra `0 12px 30px rgba(0,0,0,.25)`, **`rotate(-6deg)`**, con `I.logo` de 40px.
     - `.brand` `iManager`: 15px/800, `letter-spacing .12em`, mayúsculas, `#16181D`, `mb 10`.
     - `h1` **`Sesión cerrada`**: 32px/800, `-0.02em`, `mb 10`.
     - `p` **`Tu inventario, ventas y canjes siguen guardados en {tienda}.`**: 15px/500, `#737984`, `lh 1.5`, `max-width: 290px`, `mb 30`.
     - Botón `.cta` **`Volver a entrar`**: 52px, radio 999, `#16181D`, 15px/700, `width: 100%; max-width: 320px`.

     "Volver a entrar" lleva a `#/dash`. La pantalla entra con la animación `inF .22s`.
   - **Implementado:** no hay pantalla de salida. `logout()` cierra Firebase y `App.tsx:100-102` muestra `<Login>` directamente.
   - **Cómo corregir:** guardar `sessionStorage.setItem('imanager-session-closed', storeName)` en el handler del diálogo de confirmación, antes de `ctx.logout()`. En `App.tsx`, cuando `!user` y ese flag existe, renderizar `<SessionClosed storeName={…} onRelogin={() => { sessionStorage.removeItem(…); setShowLogin(true); }} />` en lugar de `<Login>`. `SessionClosed` va en `src/desk/screens/SessionClosed.tsx`, envuelto en `<div className="desk-app out">` para heredar los tokens. CSS:
     ```css
     .desk-app.out { align-items:center; justify-content:center; }
     .s-out { display:flex; flex-direction:column; align-items:center; text-align:center; padding:0 30px 60px; animation: inF .22s ease-out; }
     .s-out .logo { width:84px; height:84px; border-radius:26px; background:var(--lime); display:flex; align-items:center; justify-content:center; margin-bottom:22px; box-shadow:0 12px 30px rgba(0,0,0,.25); transform:rotate(-6deg); }
     .s-out .brand { font-size:15px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; margin-bottom:10px; }
     .s-out h1 { font-size:32px; font-weight:800; letter-spacing:-0.02em; margin-bottom:10px; color:#16181D; }
     .s-out p { font-size:15px; color:var(--secondary); font-weight:500; line-height:1.5; margin-bottom:30px; max-width:290px; }
     .s-out .cta { width:100%; max-width:320px; height:52px; border-radius:999px; background:#16181D; color:#fff; font-size:15px; font-weight:700; }
     ```
     Si se implementa el hash (**GL-01**), poner `#/salida` en esta pantalla.

2. **SA-02** · **Severidad:** Media
   - **Estático:** el diálogo de logout dice `¿Cerrar sesión?` con el texto **`Vas a tener que volver a entrar con tu cuenta de Google.`** y el botón `Cerrar sesión`, **sin `danger`**, así que es **negro** `#16181D` (1356; *computado*: `.dialog .ok` en `rgb(22,24,29)`).
   - **Implementado:** `DeskOverlays.tsx:104-105` dice `Vas a tener que volver a entrar.` y el botón es `danger` (rojo).
   - **Cómo corregir:** `Dialog` sin `danger`. Texto: si el proveedor es Google (`user.providerData.some(p => p.providerId === 'google.com')`), el texto exacto del estático; si no, `Vas a tener que volver a entrar con tu email y contraseña.` (adaptación necesaria por datos reales).

---

## Cosas que ya coinciden

- Sidebar: ancho 248, `padding: 20px 14px 16px`, fondo blanco con borde derecho. `.dbrand` (gap 10, 17px/800 + 12px/600). `.ditem` (42px, radio 12, 14px/700, activo en `--lime-soft`, hover `#F3F4F6`). `.dlabel` "CUENTA" (11px/800/.06em). `.dcount` (20px, `#16181D`, 11px/800) y `.dmeta`. Orden y etiquetas: Dashboard, Inventario, Ventas, Canjes, Clientes, Reportes | Cuenta: Notificaciones, Configuración. El bloque de usuario abajo navega a Configuración.
- `.stage` con `overflow-y: auto`; `.dscreen` con `max-width: 1240px` y `padding: 28px 36px 48px`; `.dtop` (flex-end, gap 20, `mb 22`); `h1` 30px y `.hero-h` 34px; `.greet` 15px/600.
- `.dbtn` (`.p`/`.s`, 42px, radio 12, hovers), `.xsearch` (salvo ancho e ícono), `.wchip`/`.wchip.on`, `.dcard`, `.dch h3`, `.dgrid.dash` (1.15fr 1fr), `.dgrid.two` (1.4fr 1fr), `.dkpis` (2×2, gap 18), `.dtable` (cabecera `#FBFBFC`, hover `#F9FAFB`), `.ring` (`conic-gradient` lima / `#ECECEC`), `.unread`.
- Textos del Dashboard: `Hola, …`, `¿Qué hay para hoy?`, `Flujo sugerido`, `Una guía rápida para arrancar el turno`, las 3 tareas, `n/3`, `faltan N` / `listo`, `Ventas del mes`, `En stock`, `N equipos`, `N disponibles`, `Canjes en curso`, `N en total`, `Saldos a cobrar`, `N clientes`, `Ventas recientes`, `Ver todas`, `Ver todos`, `No hay canjes en curso.`, columnas `Venta / Cliente / Equipo / Total / Estado`. Destinos de los KPI (Ventas, Inventario, Canjes, Clientes). El "+" abre Invitar y el CTA abre Registrar venta.
- Configuración: título y sub `Tienda, equipo y tu cuenta`, `+ Invitar al equipo` (borde superior dashed `#DADADA`), `Perfil` / `Seguridad` / `Cambiar contraseña`, `Cerrar sesión`. Sheets `Datos de la tienda`, `Perfil`, `Cambiar contraseña` (`Usá al menos 8 caracteres.`), con labels `Nombre/CUIT/Dirección/Moneda`, `Contraseña actual/Nueva contraseña/Repetir nueva` y botones `Guardar`/`Actualizar`. Toasts `Tienda actualizada`, `Perfil actualizado`, `Contraseña actualizada`, `Link copiado`.
- Notificaciones: título, chips `Todas` / `Sin leer`, clic que marca como leída y navega, contador en la sidebar.
- Sheet desktop: 540px, `max-height: 88vh`, radio 24, sombra `0 30px 80px rgba(22,24,29,.25)`. Cierra al hacer clic en el fondo (React usa `mousedown`, equivalente). `.kv`, `.dhero` y `.pick`, a grandes rasgos.
- Extras de React aceptables (no están en el estático, pero no rompen la fidelidad): **Escape** cierra los sheets (`ui.tsx:70-74`; el estático solo maneja Escape en el submodal de estados, 1837), el estado `busy` muestra `Guardando…`, y los errores de persistencia dejan el modal abierto.

## Dudas / no verificable

- **Artefactos del propio prototipo.** No se recomienda replicarlos sin confirmación del dueño:
  1. La barra de "En stock" se ve como una caja gris de 32px sin relleno, porque `.s-familia .budget { padding:16px }` se cuela en la cascada (**DA-10**).
  2. En `#/salida`, `.s-out h1` queda **blanco** (`color:#fff`, línea 349, nunca pisado), así que "Sesión cerrada" casi no se ve.
  3. En `#/salida`, la sidebar **sigue visible**: `render()` hace `$('#side').hidden = true`, pero `.side { display:flex }` le gana al atributo `hidden`. La intención del código es ocultarla.
  4. El toast de Facturación ("Plan Pro activo hasta el 05/11") contradice "Usuario Beta" / "Acceso anticipado".
- **Clic en miembros del equipo.** En el estático, los miembros que no son el usuario actual tienen `data-act="ed-role"` (`cursor:pointer`), pero `renderOverlay()` no tiene un `case 'ed-role'`, así que no abre nada. No se reporta como faltante, pero React podría ofrecer el cambio de rol (`updateMemberRole` existe en `members-api.ts:45`) si se decide.
- **Persistencia del checklist.** El estático lo guarda en memoria (se reinicia al recargar). React lo persiste en `localStorage` sin fecha, así que "Tu turno" nunca se reinicia. Sugerencia: incluir la fecha del día en `storageKey` (`imanager-desk-focus:${storeId}:${yyyy-mm-dd}`).
- **Roles.** Que STAFF no vea Reportes ni las secciones Tienda/Equipo (`DeskApp.tsx:30,64`, `AccountScreens.tsx:121`) es una decisión de roles reales; el estático no tiene roles. No se lista como desvío.
- **Badge de no leídas.** `useUnreadCount()` (`AccountScreens.tsx:65-72`) lee `localStorage` en cada render de `DeskApp`, pero no se suscribe a cambios. Hoy el badge se actualiza de casualidad (el toast o el cambio de pestaña fuerzan un rerender). Conviene pasar el estado de "leídas" a un contexto compartido.
- **Scroll al navegar.** En el estático, `render()` no resetea el `scrollTop` del stage al cambiar de ruta (solo lo restaura en los rerenders). React mantiene el mismo `<main>`. No verifiqué en navegador si el comportamiento coincide en todos los casos.
- **Visual en vivo.** El navegador integrado no estuvo disponible. Los valores *computados* salen de Chrome headless sobre el HTML local (1450×900); no tomé capturas de la app React en vivo, porque requiere sesión real.
