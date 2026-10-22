# Instalación PWA · issue #466

Implementación sobre `8115347` en `fix/466-instalar-app`, revisada el 2026-10-21. Cambios en working tree: sin commit, push, build, despliegue ni modificaciones de schema/backend.

## Comportamiento

- Una invitación blanca en Dashboard, sólo en plataforma móvil y hasta 760 px, después de 30 segundos continuos elegibles. Sesión/tienda resueltas, pestaña visible y ausencia de formularios/diálogos son requisitos; navegar, ocultar la pestaña o abrir un formulario retira el banner inmediatamente y reinicia la espera.
- **Ahora no** aplaza siete días exactos. El acceso de Más y la guía de Ayuda siguen disponibles.
- **No volver a mostrar** quita banner y tarjeta de Más. El paso de instalación del panel de Primeros pasos remite a Ayuda, sin marcarlo completo ni cambiar su progreso persistido. Ayuda conserva la guía y el subtítulo aprobado.
- Safari muestra Compartir → Agregar a inicio. Otros navegadores iOS indican primero abrir Safari. Android sin prompt muestra instrucciones manuales; un prompt tardío actualiza el mismo banner.
- `requestInstall` distingue accepted/dismissed/unavailable y consume cada evento una vez. Cerrar el prompt aplaza siete días. Aceptarlo suprime la invitación durante esa sesión, sin afirmar que la instalación terminó. Standalone y appinstalled ocultan banner/tarjeta.
- Preferencia por navegador/origen `imanager:install-preference:v2`, con migración conservadora de las tres claves anteriores, sincronización entre componentes/pestañas, vencimiento con la app abierta y fallback en memoria si localStorage falla.

## Reproducción y límites

El problema original se confirmó en el código de la base y en las expectativas anteriores: iOS/Android con prompt podían salir de Dashboard; el descarte dejaba una acción compacta y Más ignoraba el descarte. Las 29 pruebas anteriores de InstallApp/InstallHelp aprobaron antes de los cambios. No hubo sesión autenticada productiva para reproducir la versión servida; no se afirma esa comprobación.

Las capturas usan componentes/páginas reales de la app, Vite en modo desarrollo (sin worker/caché PWA), autenticación de prueba, datos ficticios y API/cotización completamente simuladas. No se inicia backend para obtenerlas. Se conserva el Dashboard, la navegación y la estructura de Más existentes en esta base; sus diferencias con las referencias quedan fuera de #466 y se coordinan en #450/#453.

Chromium emula iPhone 13 con user agent iOS, touch y viewport 390×844; Android usa user agent Pixel con el mismo viewport. Desktop: 1440×900. WebKit no pudo arrancar por bibliotecas del sistema faltantes (GTK4, Graphene, GStreamer, AVIF y otras). Puede elegirse con `INSTALL_466_WEBKIT=1` en un host preparado. Estas pruebas no acreditan instalación física en Safari/Android ni detección universal de una instalación al abrir una pestaña normal.

## Validación

| Comprobación | Resultado |
|---|---|
| Frontend completo | 161 archivos, 1.182 pruebas aprobadas |
| Backend unitario completo | 76 archivos, 516 pruebas aprobadas |
| Backend integración completo | 40 archivos, 362 pruebas aprobadas en seis particiones |
| TypeScript/lint frontend y backend | Aprobados |
| Worker/servidor PWA | 15 pruebas aprobadas |
| Playwright específico | 5 escenarios aprobados, sin retries |
| OpenSpec estricto | Aprobado |

La corrida larga de integración fue terminada con SIGTERM por el entorno; la suite completa aprobó en particiones secuenciales para respetar el límite de ejecución de comandos: 79 + 78 + 115 + 55 + 16 + 19 = 362 pruebas, sin fallos. Única DB: PostgreSQL local `127.0.0.1:5432/imanager_test`. No se ejecutaron E2E que requieren un despliegue completo/build de producción.

```bash
npm run test:frontend -- --maxWorkers=2
npm run test:backend:unit
# Ejecutar de forma secuencial, con DATABASE_URL apuntando a imanager_test local:
npm --prefix backend run test:integration -- --shard=1/6
npm --prefix backend run test:integration -- --shard=2/6
npm --prefix backend run test:integration -- --shard=3/6
npm --prefix backend run test:integration -- --shard=4/6
npm --prefix backend run test:integration -- --shard=5/6
npm --prefix backend run test:integration -- --shard=6/6
npm run lint
npm --prefix backend run lint
npm run test:pwa
npx playwright test --config e2e/playwright.install-466.config.ts
git diff --check
```

## Capturas PNG

El spec regenera estos archivos dentro del repo y comprueba ancho sin overflow, botones de descarte de 44 px y separación entre aviso y barra inferior:

| Estado | Evidencia |
|---|---|
| Dashboard iPhone | [iphone-dashboard.png](iphone-dashboard.png) |
| Android con prompt | [android-native.png](android-native.png) |
| Android manual | [android-manual.png](android-manual.png) |
| Ahora no | [iphone-ahora-no.png](iphone-ahora-no.png) |
| Más durante aplazamiento | [iphone-mas.png](iphone-mas.png) |
| Descarte permanente | [iphone-no-volver.png](iphone-no-volver.png) |
| Formulario abierto | [iphone-formulario.png](iphone-formulario.png) |
| Standalone | [iphone-standalone.png](iphone-standalone.png) |
| Ayuda móvil | [iphone-ayuda.png](iphone-ayuda.png) |
| Guía desde Ayuda tras descarte | [iphone-guia.png](iphone-guia.png) |
| Ayuda desktop | [desktop-ayuda.png](desktop-ayuda.png) |
