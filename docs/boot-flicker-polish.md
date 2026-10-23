# Boot y revalidación sin parpadeos

Implementación en `fix/boot-flicker-polish`. Sin comandos git de escritura, cambios de backend/Prisma, dependencias nuevas ni cambios a las pantallas, tests o CSS específicos de Dashboard.

## Criterios A–H

- **A:** Splash estático externo a `#root`, fondo `#F7F8FA` desde el HTML inicial, ícono existente de 80 px, sin texto/animación de entrada. Auth, sesión y lecturas iniciales se resuelven detrás. Un observer usa `aria-busy` y los placeholders compartidos para esperar la pantalla estable antes de una salida única de 100 ms y retiro del DOM. Reduced-motion retira inmediatamente. Incluye catálogo público y fallback de error persistente.
- **B:** Identidad de negocio estable y credenciales de Firebase mediante ref. Los efectos dependen del uid/scope. Se esperan permisos y tienda de `/api/me` antes de cargar listas. Repairs se limpia por cambio real de usuario/tienda o pérdida de acceso. Se eliminaron refrescos iniciales duplicados de Primeros pasos y SampleStockBanner.
- **C:** `keepIfEqual` y `useStableState` comparten objetos y filas iguales, incluso si se reordenan; no serializan los arrays. Aplicados a listas/cachés, repairs, notificaciones, borradores, sesión/billing, depósitos, novedades, onboarding-progress, comisiones, cajas, gastos/proveedores, devoluciones, catálogos y dólar. Los fallos de revalidación conservan datos y no reactivan loading. Las respuestas parciales de borradores no descartan datos anteriores.
- **D:** Compuerta de listas de 15 s desde finalización; eventos recientes se descartan y las mutaciones BroadcastChannel siguen siendo inmediatas, con reconciliación si hay una consulta en vuelo. Billing espera sesión confirmada y aplica la misma compuerta a foco/poll. `/health` compartido pasa a 5 s y pausa consultas ocultas. `online.ts` ya emite cambios de conectividad solamente cuando el valor cambia; no tiene setters periódicos.
- **E:** Actualización automática solo oculta y segura. Visible conserva el toast/manual. Una actualización pendiente tras 3 minutos oculta puede recargar al volver: primero splash opaco y dos frames antes de reload. Se preservan `RELOAD_KEY` y las guardas de formularios/diálogos/drafts.
- **F:** Sin fade por ruta. Scrim independiente a 120 ms, modal desktop a 160 ms con escala .985, hoja mobile opaca desde el inicio y desplazamiento 24 px/200 ms, menús a 100 ms. Skeletons estáticos diferidos 180 ms, bloqueo sin spinner, indicadores de envío diferidos 300 ms. Regla global reduced-motion. Se acortó el indicador de tabs y se retiró confetti/pulse/shimmer.
- **G:** Chip de dólar con ancho/alto reservados, ajustado a pantallas angostas. InstallApp, billing, muestras y FX flotan fuera del flujo. El diálogo de muestras sale del contenedor flotante para conservar focus/capas. La oferta de contacto espera la retirada del splash.
- **H:** Los errores de red siguen como señales internas de recuperación. Refetch con datos no muestra mensajes ni acciones rojas; dólar mantiene cotización disponible. Se conservaron nombres accesibles «Cargando» y errores persistentes pertinentes.

## Alcance pendiente del Dashboard

`DashboardContent.tsx` aún ejecuta `setReport(null)` cuando cambia realmente `sales`, `inventory`, el rango o sus demás dependencias. Las respuestas iguales ya conservan identidad desde el contexto. Al regresar a la ruta, el remount reinicia el estado local y vuelve a consultar overview. Ese comportamiento y el borrado previo de `members` quedan para el ejecutor del Dashboard; no se modificaron esos archivos. El splash coordina su carga inicial mediante estados accesibles existentes.

## Verificación

Frontend: `npm run lint` aprobado; backend: `npm --prefix backend run lint` aprobado. `npm run test:frontend`: 202 archivos / 1.675 pruebas aprobadas en 82,01 s. `npm run test:pwa`: 15/15 aprobadas. `npm run build`: aprobado en 16,28 s. `git diff --check`: aprobado. Solo Vitest/componentes existentes y pruebas PWA; sin E2E nuevos. El build conserva los avisos de Vite por chunks grandes e imports estáticos/dinámicos existentes.

## Archivos tocados

- `PROJECT_STATUS.md`
- `docs/boot-flicker-polish.md`
- `index.html`
- `openspec/changes/fix-boot-flicker-polish/design.md`
- `openspec/changes/fix-boot-flicker-polish/proposal.md`
- `openspec/changes/fix-boot-flicker-polish/specs/app-presentation/spec.md`
- `openspec/changes/fix-boot-flicker-polish/tasks.md`
- `scripts/pwa.test.mjs`
- `src/App.boot.test.tsx`
- `src/App.tsx`
- `src/boot-session.test.tsx`
- `src/catalog/PublicCatalogPage.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/InstallApp.tsx`
- `src/components/PwaUpdate.test.tsx`
- `src/components/PwaUpdate.tsx`
- `src/components/Skeleton.test.tsx`
- `src/components/skeleton.css`
- `src/context/AppContext.concurrency.test.tsx`
- `src/context/AppContext.tsx`
- `src/context/cash-state.ts`
- `src/context/commission-state.ts`
- `src/context/getting-started-state.test.tsx`
- `src/context/getting-started-state.ts`
- `src/context/ledger-state.ts`
- `src/context/public-catalog-state.ts`
- `src/context/returns-state.ts`
- `src/context/section-views-state.test.tsx`
- `src/context/section-views-state.ts`
- `src/context/store-records.test.tsx`
- `src/context/store-records.ts`
- `src/desk/BlueDollar.test.tsx`
- `src/desk/BlueDollar.tsx`
- `src/desk/DeskApp.tsx`
- `src/desk/catalog.tsx`
- `src/desk/desk.css`
- `src/desk/exchange.tsx`
- `src/desk/first-steps-island.tsx`
- `src/desk/getting-started.tsx`
- `src/desk/mobile-tab-bar.tsx`
- `src/desk/offline-banner.test.tsx`
- `src/desk/offline-banner.tsx`
- `src/desk/row-actions-sheet.test.tsx`
- `src/hooks/useBillingState.ts`
- `src/index.css`
- `src/lib/auth-identity.test.ts`
- `src/lib/auth-identity.ts`
- `src/lib/boot-splash.test.ts`
- `src/lib/boot-splash.ts`
- `src/lib/cached-auth-user.ts`
- `src/lib/list-sync.test.ts`
- `src/lib/list-sync.ts`
- `src/lib/stable-state.test.ts`
- `src/lib/stable-state.ts`
- `src/pages/onboarding.css`
