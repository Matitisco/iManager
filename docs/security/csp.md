# CSP del POS

## Superficies y política

El HTML del POS lo entrega `npm start` → `scripts/serve-spa.mjs`, también para rutas SPA y catálogos públicos. **Su header es el que gobierna los recursos del navegador.** `vite preview`/el servidor de desarrollo no representan este despliegue. No se consultó producción para esta tarea.

La API Fastify (`backend/src/lib/http-security.ts`) entrega JSON con su CSP independiente `default-src 'none'; frame-ancestors 'none'; base-uri 'none'`, ya enforcing. Ese header no restringe el documento que se cargó desde el frontend. La landing tiene otro servicio/servidor y queda fuera de este cambio.

La SPA ahora aplica `Content-Security-Policy` completa por defecto:

| Directiva | Permisos y motivo |
| --- | --- |
| `default-src` | `'self'` como fallback. |
| `script-src` | `'self'`, hashes SHA-256 del bootstrap confiable, apis.google.com, subdominios googleapis.com/gstatic.com, accounts.google.com, PostHog US/EU (ingest y assets), host PostHog configurado y sdk.mercadopago.com. Sin `unsafe-inline` ni `unsafe-eval`. |
| `script-src-attr` | `'none'`: bloquea handlers HTML inline. |
| `style-src` | `'self' 'unsafe-inline'` y fonts.googleapis.com. React/Motion usan estilos dinámicos y atributos style; nonces/hashes de estilos no cubren esos atributos. Endurecer esto exige otro cambio de renderizado. |
| `font-src` | Propio, fonts.gstatic.com y data:. El CSS usa Inter y DM Sans de Google Fonts. |
| `img-src` | Propio, data:, blob:, subdominios googleusercontent.com (avatar Google), Unsplash y Firebase Storage. |
| `connect-src` | Propio, **origen exacto de la API del build**, googleapis.com (incluye identitytoolkit/securetoken), apis.google.com, gstatic.com, accounts.google.com, Firebase Realtime HTTPS/WSS, PostHog y las cotizaciones existentes. No hay WebSocket de negocio en `src/`; un servicio nuevo necesita su origen WSS explícito. |
| `frame-src` | Propio (helper proxy iOS), *.firebaseapp.com, accounts.google.com, dominio Firebase configurado y MercadoPago existente. |
| `worker-src` / `manifest-src` | `'self' blob:` para SW/replay; manifest sólo propio. Blob no se permite como script de la página. |
| `media-src` | Propio y blob:. |
| `base-uri` / `object-src` / `frame-ancestors` | `'self'` / `'none'` / `'none'`. |

`csp-config.json` se genera con Vite: sólo contiene los orígenes públicos de `VITE_API_BASE_URL`, `VITE_POSTHOG_HOST` y `VITE_FIREBASE_AUTH_DOMAIN`. Así **producción y test usan cada uno la URL real compilada en su frontend**, sin inventar dominios Railway, abrir `*.railway.app` ni depender de variables disponibles sólo en runtime. No hace falta permitir simultáneamente ambas APIs en cada despliegue. El archivo no copia claves. Sin configuración PostHog conserva su host público US; también se permiten los endpoints US/EU actuales. Los builds antiguos sin este archivo pueden usar las variables públicas de runtime.

Los hashes se calculan una vez sobre `dist/index.html`, antes de insertar metadatos del catálogo. No se autorizan scripts procedentes de parámetros ni de datos de negocio. Esto conserva el bootstrap de tema y es compatible con el HTML cacheado por la PWA; no requiere reescribir HTML con nonces por respuesta.

**Excepción acotada:** `/__/auth/*` sigue proxyando HTML/scripts controlados por Firebase con `base-uri 'self'; object-src 'none'; frame-ancestors 'self'` y SAMEORIGIN. No se impone la CSP del shell al HTML ajeno del proveedor. Esa excepción se decide usando el mismo pathname normalizado que el router: `/__/auth/../../` no puede quitar la CSP del shell. El proxy conserva no-store; la API y otros paths no reciben esta excepción.

## Agregar un origen

1. Si cambia API, proxy PostHog o authDomain, actualizar la variable `VITE_*` correspondiente y reconstruir el frontend. El manifest público y la política recogerán el origen exacto. Cambiar sólo runtime no cambia URLs ya compiladas.
2. Para otra integración, agregar únicamente el origen y directiva necesarios en `scripts/security-headers.mjs`; evitar `*`, `https:` global y `unsafe-inline` en scripts. Una nueva conexión WSS necesita autorización explícita; el WebSocket de HMR no forma parte del build productivo.
3. Actualizar `scripts/http-security.test.mjs` y recorrer el build con `scripts/csp-browser.mjs` primero en Report-Only y después enforcing. Revisar también subrecursos, popups/iframes y workers. No solucionar un bloqueo desactivando todas las directivas.

## Rollback sin cambiar código

Configurar **`CSP_REPORT_ONLY=true` en el servicio frontend** y reiniciar/redeployar el proceso con esa variable. No requiere nuevo commit ni rebuild del bundle. La política completa pasa a `Content-Security-Policy-Report-Only`; base-uri/object-src/frame-ancestors permanecen enforcing. Quitar la variable o poner `false` vuelve a enforcing. No ponerla solamente en la API.

Verificar ambos headers en la respuesta HTML nueva. Una pestaña ya abierta o un shell servido offline conserva los headers que recibió: requiere navegación online/recarga para adoptar el rollback. No se modifican retención ni cachés de negocio. No hay colector remoto de violaciones; observar DevTools o instalar un listener local de `securitypolicyviolation` sin copiar URLs/tokens de usuarios.

## Validación y rollout

Se usó únicamente PostgreSQL descartable `csp_enforcing` en `127.0.0.1:37121`, API local 37549 y frontend 41477, con fixtures ficticios. Sin migraciones, cambios de schema, consultas a producción ni reversión de #691. Dependencias instaladas con npm ci; máximo dos workers; sin suite completa local.

Recorrido reproducible, con API de pruebas levantada contra una DB exclusiva y los usuarios ficticios `dueno@imanager.local` y `google.tester@imanager.test` vinculados a una tienda:

```sh
# Primera variante: email y Google emulados por el adapter E2E.
VITE_API_BASE_URL=http://127.0.0.1:37549 VITE_TEST_AUTH_MODE=e2e npm run build
CSP_PORT=41477 CSP_AUTH_MODE=e2e node scripts/csp-browser.mjs

# Segunda variante: adapter Firebase real y SDK PostHog real con respuestas mock.
# El identificador del proyecto es ficticio; todo tráfico externo se intercepta.
VITE_API_BASE_URL=http://127.0.0.1:37549 VITE_TEST_AUTH_MODE= VITE_POSTHOG_KEY=phc_local_csp_fixture npm run build
CSP_PORT=41477 node scripts/csp-browser.mjs

node --test --test-concurrency=2 scripts/http-security.test.mjs scripts/basic-auth.test.mjs
node scripts/pwa.test.mjs
npx vitest run --maxWorkers=2 src/lib/posthog-analytics.test.ts src/services/auth-adapter.test.ts
```

Cada variante sirve el build con **el mismo handler de producción**, primero Report-Only y después enforcing; Chromium usa `/usr/bin/google-chrome --no-sandbox`. Se capturan eventos CSP y errores CSP de consola desde antes de cargar el documento. Se recorren 20 pantallas, login, recarga, manifest, SW real y worker blob; se prueban recursos de Google/Firebase, helper same-origin e imágenes data/blob. Los probes negativos finales de enforcing son deliberados y se cuentan aparte: scripts inline arbitrarios y de un origen no autorizado deben quedar bloqueados.

La prueba real de PostHog detectó que el scrubber de #727 eliminaba también `properties.token`, el **identificador público** del proyecto requerido por el SDK para ingestar eventos y snapshots. Se restaura exclusivamente el valor de configuración, después del filtrado; tokens de identidad, atributos personales y tokens anidados continúan eliminados. Hay regresiones para pageview/snapshot. No se cambian consentimiento, masking ni retención.

**Requiere OK de Matias:** habilitar enforcing afecta a todos los clientes y restaurar ingestión PostHog es observable en analítica. Mantener el PR abierto para su aprobación. Recomiendo desplegar primero en **test y observar varios días** antes de considerar producción. No se desplegó ni se integró este cambio en producción.

Los mocks no prueban consentimiento OAuth, cookies, dominios autorizados ni la configuración de un proyecto real. En test aún hay que verificar Google popup desktop/Android y redirect en Safari/PWA iOS, cerrar/cancelar/reintentar, expiración/refresco de sesión, ingestión/reproducción de PostHog y proxies personalizados. Tampoco se prueban cobros reales. El SDK de terceros puede cambiar subdominios: revisar violaciones antes del rollout y mantener disponible el rollback.

Resultados locales: ambas variantes completaron Report-Only y enforcing con **0 violaciones no intencionales**; la segunda confirmó envío de snapshots `/s/` interceptados. Los dos probes negativos de enforcing quedaron bloqueados. TypeScript frontend/backend aprobado; 37 pruebas frontend de analítica/auth, 16 de headers/Basic Auth, 15 PWA/worker y 9 de seguridad HTTP de API aprobadas. Suite completa reservada a CI remoto.

Referencias: [CSP y hashes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [dominios y workers de PostHog](https://posthog.com/docs/advanced/content-security-policy), [helpers y redirect de Firebase](https://firebase.google.com/docs/auth/web/redirect-best-practices).
