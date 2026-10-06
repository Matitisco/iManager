# hi-fi desk — desvíos entre el prototipo estático y la implementación

Auditoría de fidelidad del frontend hi-fi de la rama `hifi-desk` contra el prototipo estático.

- **Referencia (estático):** `iManager-desktop-pantallas-v2/imanager-desk.html` (publicado en [demo-web-production-13a8.up.railway.app](https://demo-web-production-13a8.up.railway.app/imanager-desk.html#/dash)) y las capturas `01`–`21` de esa misma carpeta.
- **Implementación:** `src/desk/` en la rama `hifi-desk` (publicada en [hifi-desk-production.up.railway.app](https://hifi-desk-production.up.railway.app/)).
- **Fecha:** 2026-10-06.

## Cómo leer el prototipo

El HTML define primero una versión **mobile** (`sDash`, `sInv`, `sVen`… en las líneas ~1029-1226) y después, desde la línea ~1593, una capa **desktop** que redefine esas funciones (`sideHTML`, `dtop`, `sDash`, `eqList`, `veTable`, `cjList`…). También redefine tokens CSS en un segundo `:root` (línea ~460). Al final (líneas ~1721-1839) agrega el sistema de catálogos editables (`ST_PAL`, `STK`, `STC`, `openSub`, `renderSub`, `saveSub`): es el "lapicito" que abre los submodales de estados, capacidades, condiciones y etiquetas.

**La referencia es la capa desktop.** Notificaciones, Configuración, Reportes y Salida se renderizan en desktop reutilizando la función mobile envuelta con `wrapMobile(fn, cls)`. Como el prototipo aplica clases mobile y desktop a la vez, varias medidas solo se pueden resolver midiendo; esas aparecen marcadas como *computado* (Chrome headless, viewport 1450×900).

## Criterio

- **No se listan** las diferencias de *datos demo vs. datos reales*.
- **Sí se listan** los campos, métricas o funciones que el estático muestra y React omite o calcula distinto, junto con la fuente real que los alimentaría o el cambio de backend/schema que hace falta.
- Cada desvío tiene un **ID**, una **Severidad**, la descripción del **Estático** (con líneas del HTML), la del **Implementado** (con `archivo:línea`) y **Cómo corregir**.
- Severidad **Alta**: se nota a simple vista o falta la funcionalidad. **Media**: diferencia de detalle notable. **Baja**: detalle fino.

## Documentos

| Documento | Áreas | Prefijos de ID | Alta | Media | Baja | Total |
|---|---|---|---|---|---|---|
| [`01-shell-dashboard-cuenta.md`](01-shell-dashboard-cuenta.md) | Global, Sidebar, Header, Dashboard, Notificaciones, Configuración, Modales genéricos, Salida | `GL` `SH` `HD` `DA` `NO` `CF` `MG` `SA` | 5 | 44 | 30 | 79 |
| [`02-inventario.md`](02-inventario.md) | Inventario, menú contextual, detalle/editar/eliminar/registrar equipo, submodales de estados/capacidades/condiciones, importar | `IN` `CX` `DE` `EE` `EL` `RE` `SE` `SC` `SD` `IM` | 15 | 28 | 9 | 52 |
| [`03-ventas-canjes-clientes-reportes.md`](03-ventas-canjes-clientes-reportes.md) | Ventas y sus modales, Canjes y sus modales, submodal de estados de canje, Clientes y sus modales, etiquetas, Reportes, menús contextuales | `VE` `MV` `CJ` `MC` `SJ` `CL` `MK` `ET` `RP` `MX` | 11 | 35 | 16 | 62 |
| **Total** | | | **31** | **107** | **55** | **193** |

Algunos desvíos aparecen en más de un documento porque afectan a todos los modales. Se corrigen una sola vez:

- Botones de modal: **MG-02** = **DE-02** = **MV-02**.
- Diálogo compacto de confirmación: **MG-01** = **EL-01**.
- Labels de formulario: **MG-03** = **EE-02** ≈ **MV-01** (parte de labels).
- Inputs de formulario: **MG-04** = **EE-08** ≈ **MV-01** (parte de inputs).
- Validación por campo: **MG-05** = **EE-03** (parte visual) = **MV-04**.
- Overlay, animaciones, `h3` y `.sub` del sheet: **MG-06** ≈ **MV-03** ≈ **DE-03**.
- Lapicito y submodal de catálogos: **SE-01**…**SE-10**, **SC-01**, **SD-01**, **SJ-01**, **MV-05**, **MC-06** y **ET-01** describen el mismo componente aplicado a distintos tipos.

## Causas transversales

Gran parte de la diferencia visual sale de pocas causas. Corrigiéndolas primero cambia casi todas las pantallas a la vez:

1. **Tokens CSS** (**GL-04**): `--row` vale `#F7F8FA` (igual al fondo de página) en vez de `#F0F1F3`. Por eso inputs, botones secundarios, `.kv`, `.dhero` y fondos de íconos casi no se distinguen. Faltan `--section`, `--sh` y la paleta `--c-*`.
2. **Preflight de Tailwind** (**GL-02**): fuerza `line-height: 1.5` dentro de `.desk-app`, mientras que el estático usa `normal`. Todos los bloques de texto quedan más altos. A esto se suma la fuente DM Sans con eje `opsz` (**GL-03**).
3. **Sistema de modales** (**MG-01** a **MG-06**): los botones son rectángulos de 46px con radio 12 cuando deberían ser pills de 52px. Faltan el diálogo compacto centrado, los labels en mayúsculas grises de 11px, los inputs de 48px, la validación por campo con «Completá este dato» y las animaciones `fadeIn` / `pop`.
4. **Pills de estado** (**GL-07**): mezcla de color 16%/72% en vez de 14%/78%, alto fijo de 26px y `.spill.off` en rojo cuando debería ser negro.
5. **Íconos** (**SH-01** y siguientes): la sidebar y los KPI usan otros SVG. Los documentos incluyen los paths exactos del prototipo.
6. **Catálogos editables** (lapicito): no existen en React. Las opciones de estados, capacidades, condiciones y etiquetas están fijas en el código, así que tampoco se propagan cambios (capturas 06-12, 16 y 18).
7. **Navegación** (**GL-01**, **GL-09**, **GL-17**, **SA-01**): no hay rutas por hash ni transición de pantalla, y el logout no tiene confirmación ni pantalla «Sesión cerrada».

## Modelo de datos unificado para los catálogos

Los documentos 02 y 03 proponen dos modelos con nombres distintos (`StoreCatalogOption` en **SE-02** y `StatusOption` en **SJ-01**). Son la misma idea; conviene implementar **uno solo** que cubra todos los tipos:

```prisma
enum CatalogKind {
  INVENTORY_STATUS
  INVENTORY_CAPACITY
  INVENTORY_CONDITION
  SALE_STATUS
  TRADE_IN_STATUS
  CLIENT_TAG
}

model StoreCatalogOption {
  id        String      @id @default(cuid())
  storeId   String
  kind      CatalogKind
  value     String      @db.VarChar(30) // lo que se guarda en el registro (clave estable para estados)
  label     String      @db.VarChar(20) // lo que se muestra (maxlength=20 como el estático)
  color     String?     @db.VarChar(9)  // estados y etiquetas
  isSystem  Boolean     @default(false) // se puede renombrar y recolorear, no borrar
  sortOrder Int         @default(0)
  store     Store       @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([storeId, kind, value])
  @@index([storeId, kind])
}
```

- **Estados** (equipo, venta, canje): el registro guarda `value`, que es una clave estable (`DISPONIBLE`, `VENDIDO`, `PENDIENTE`…). Renombrar solo cambia `label`, así que la lógica de ventas y reportes que depende de esas claves sigue funcionando. Los de sistema son los que marca `STK.*.sys` en el HTML (línea ~1723).
- **Capacidades y condiciones**: el equipo guarda el texto. Renombrar implica un `updateMany` de los equipos.
- **Etiquetas de cliente**: evaluar si reutilizar `ClientCategory` agregándole `color` o usar `CLIENT_TAG` (ver la opción (a) vs (b) en **ET-01**).
- **API:** `GET /api/catalogs` siembra los valores por defecto si la tienda no tiene filas. `PUT /api/catalogs/:kind` recibe `{ options, deletions: [{ value, reassignTo }] }` y aplica en una sola transacción las altas, los renombres, los borrados y las reasignaciones. Debe rechazar borrar un `isSystem`.
- **Frontend:** un único componente `CatalogEditor` (estructura y clases `stx-*` del HTML, líneas 853-885) que reciba `kind`. Va montado por encima del sheet (`z-index: 120`), con Escape propio. Los catálogos viven en `AppContext`, y `Pill`, `statusLabel`, `statusColor`, chips, columnas del kanban y segmentados los leen desde ahí.
- Usar la skill `schema-change` y registrar el cambio en OpenSpec antes de implementarlo.

## Plan de corrección sugerido

Ordenado para que cada fase deje la app usable y mejore lo más visible primero.

### Fase 1 — base visual (aplicada en `hifi-desk`)

**GL-02**, **GL-03**, **GL-04**, **GL-05**, **GL-06**, **GL-07**, **GL-08**, **GL-10**, **GL-11**, **GL-12**, **GL-14**, **GL-15**, **GL-16**, **MG-02**, **MG-03**, **MG-04**, **MG-06** a **MG-12**, **MV-03**, **SH-01** a **SH-06** y **HD-01** a **HD-05**.

### Fase 2 — comportamiento del shell y de los modales (frontend)

**GL-01**, **GL-09**, **GL-13**, **GL-17** (rutas por hash, transición, mantener apretado y cierre de overlay al navegar), **MG-01** / **EL-01** (diálogo compacto), **MG-05** / **MV-04** / **EE-03** (validación por campo, IMEI de 15 dígitos), **CF-10** y **SA-01** (confirmación de logout y pantalla «Sesión cerrada»).

### Fase 3 — fidelidad pantalla por pantalla (frontend)

- **Dashboard:** DA-01 a DA-15.
- **Inventario:** IN-01 a IN-10, CX-01 a CX-03, DE-01, DE-03, DE-04, EE-04 a EE-10, EL-02, RE-02, RE-03 e IM-01 a IM-05.
- **Ventas:** VE-01 a VE-10, MV-07 a MV-10, MV-12 y MV-13.
- **Canjes:** CJ-01 a CJ-06 y MC-01 a MC-05.
- **Clientes:** CL-02 a CL-05, MK-02 y MK-03.
- **Reportes:** RP-01 a RP-12.
- **Notificaciones y Configuración:** NO-01 a NO-08 y CF-01 a CF-14.
- **Menús contextuales:** MX-01 a MX-04.

**MV-12** es un bug: el botón «Vender» del detalle de equipo no preselecciona el equipo. Se arregla con una línea en `DeskOverlays.tsx:128` y conviene hacerlo primero.

### Fase 4 — funcionalidades que necesitan backend

- **Catálogos editables** (ver el modelo unificado más arriba): SE-01 a SE-10, SC-01, SC-02, SD-01, SD-02, EE-01, EE-07, RE-01, IN-05, SJ-01, SJ-02, MV-05, MC-06, ET-01 y CL-01.
- **«Consumidor final» en ventas** (**MV-06**): `clientId` opcional en `saleCreateSchema`. Prisma ya lo permite como nulo.
- **Registrar pago de cliente** (**MK-01**) y descuento del saldo al cobrar una venta (**MV-11**).
- **Normalización de estado y condición en el import** (**IM-06**).

## Decisiones pendientes

Estos puntos necesitan una decisión de producto antes de implementarse. El detalle está en la sección «Dudas / no verificable» de cada documento.

1. **Errores del propio prototipo.** No conviene copiarlos sin confirmación:
   - La barra de «En stock» del Dashboard se ve como una caja gris sin relleno.
   - En `#/salida` el título «Sesión cerrada» queda blanco sobre fondo claro y la sidebar sigue visible.
   - El toast de Facturación («Plan Pro activo hasta el 05/11») contradice «Usuario Beta».
2. **«Reservado» en los chips de Inventario.** El estático lo excluye por *nombre*, así que al renombrarlo aparece el chip (captura 09). Hay que decidir si se excluye por clave `RESERVADO`.
3. **Permisos sobre catálogos.** Falta definir si un `STAFF` puede crear o borrar estados, o solo `OWNER` / `MANAGER`.
4. **Campos que React tiene y el estático no:** «Grado» editable y «Modelo» como texto libre (**EE-05**, **EE-06**), y el alta de cliente inline en Registrar venta (**MV-06**). Pueden ser intencionales por los datos reales.
5. **Etiquetas de cliente:** reutilizar `ClientCategory` o crear un catálogo nuevo.
6. **Fuente de Reportes:** seguir calculando en el cliente o usar `fetchReportsOverview`, que ya agrupa en el backend.
7. **Checklist del Dashboard:** hoy se persiste en `localStorage` sin fecha, así que «Tu turno» nunca se reinicia. La propuesta es incluir la fecha en la clave.

## Límites de esta auditoría

- La comparación se hizo leyendo el HTML y el código React línea por línea, contra las 21 capturas. Las medidas *computadas* salen de Chrome headless sobre el HTML local.
- La app React **no se revisó en vivo**, porque requiere una sesión real de Firebase. Conviene validar visualmente cada fase en `hifi-desk-production.up.railway.app` después de corregirla.
- Las medidas en píxeles tomadas de las capturas son aproximadas. Cuando hay valor en el CSS del HTML, manda ese.
