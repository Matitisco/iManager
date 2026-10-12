# iManager instalable — issue #290

La PWA usa el logo de `/workspace/imanager-logo/propuesta-3/png/isotipo-512.png`. El manifest abre `/` en modo standalone, con íconos PNG de 48 a 512 px y variantes maskable de 192/512 px. Apple recibe íconos de 120/152/167/180 px y 26 imágenes de apertura para 13 combinaciones de tamaño/densidad de iPhone, en vertical y horizontal. La barra de estado usa texto oscuro sobre las superficies claras de la app.

La invitación aparece en teléfonos después de 30 segundos con una sesión y tienda resueltas, la pestaña visible y sin un overlay de operación/invitación activo. Safari muestra Compartir → Agregar a inicio con dibujos de ambos controles; Android ofrece Instalar app cuando el navegador entrega `beforeinstallprompt`. Cerrar, Ahora no o descartar el prompt nativo guarda la decisión en ese navegador. Desktop y standalone no muestran la invitación. iOS reconoce también `navigator.standalone`.

El worker se genera únicamente en builds de producción. La caché contiene el HTML genérico y los bundles de esa versión; los logos/íconos públicos se guardan cuando se solicitan. No almacena API, Firebase, `/version.json`, peticiones autenticadas, dominios externos ni URLs con query strings (incluidos enlaces de recuperación de contraseña). Abrir sin conexión carga el shell y muestra el error del backend: no ofrece datos de negocio offline. Cada build publica `/version.json` con el mismo id embebido en el bundle. Una pestaña abierta lo compara (`cache: no-store`) al volver, al enfocar y cada tres minutos, y también escucha `controllerchange`. Sin datos sin guardar recarga sola; con un formulario o borrador abierto muestra «Nueva versión disponible · Actualizar» y recarga al guardarlo, cerrarlo o cuando ya no hay borrador. El servidor entrega el manifest con su MIME y el worker y `version.json` con `no-store`.

## Firebase y configuración de despliegue

Google usa redirect en iOS standalone y popup en el navegador. Email/password mantiene el flujo actual. Los resultados de redirect se procesan una vez; Login muestra los errores al volver. La persistencia de sesión la administra Firebase, fuera de la caché del service worker.

Safari requiere que el helper OAuth comparta origen con la app. En iOS standalone, `src/firebase.ts` usa el host de la app como `authDomain`; `npm start` reenvía `/__/auth/*` y `/__/firebase/init.json` al dominio Firebase original. Una falla del proxy produce 502 visible, nunca el HTML del shell. Este enfoque sigue la [guía oficial de Firebase para redirect en Safari](https://firebase.google.com/docs/auth/web/redirect-best-practices).

Antes de probar Google en producción:

1. Servir la app por HTTPS con `npm start` y permitir al servidor acceder al dominio Firebase configurado. Si otro hosting sirve `dist`, debe implementar ese mismo proxy sin redirigir al cliente al dominio Firebase.
2. Confirmar el dominio público de iManager en Firebase Authentication → Settings → Authorized domains.
3. Agregar `https://<dominio-de-imanager>/__/auth/handler` a Authorized redirect URIs del cliente web de Google OAuth. Conservar el handler Firebase existente para popup.
4. Verificar que `/sw.js` devuelve JavaScript y `/__/auth/iframe` devuelve el helper Firebase, no el shell de React.

Esta sesión no modificó Firebase/Google ni desplegó la rama. La configuración del handler y el OAuth real necesitan verificación en el origen desplegado.

## Pruebas reproducibles

```bash
npm run lint
npm --prefix backend run lint
npm run build
npm run test:pwa
npm run test:frontend
OPENAI_API_KEY= npm --prefix backend run test:unit
npx playwright install --with-deps chromium webkit
npm run test:pwa:e2e
```

La suite PWA de navegador construye en `.pwa-test-dist`, independiente de `dist`, con identidad de prueba y respuestas API simuladas. Verifica guía Safari, descarte persistido, prompt Android, sesión de prueba en standalone y el worker real al abrir offline. No prueba Google OAuth real. Usa el puerto 4192 sin base de datos; la suite E2E general la excluye porque usa el servidor Vite de desarrollo.

Para regenerar los assets, con Pillow disponible:

```bash
python3 scripts/generate-pwa-assets.py /workspace/imanager-logo/propuesta-3/png
```

## Resultado de esta sesión

- Build de producción aprobado; Vite conserva el aviso de tamaño del bundle existente.
- TypeScript frontend/backend aprobado.
- Suite frontend completa intentada: las cuatro suites que arrancan Chromium fallan al iniciar el navegador por restricciones del sandbox; sus siete pruebas no se ejecutan. Las restantes pruebas pasan.
- Backend: 212 unitarios aprobados al desactivar explícitamente los 20 tests live de OpenAI; la primera ejecución con la variable heredada falló en esos tests por el acceso externo no disponible. No se cambió código de backend ni se usó una base de producción.
- Worker/servidor/manifest/assets: pruebas aprobadas mediante el handler HTTP real y el worker generado ejecutado en un entorno de eventos controlado, sin sockets.
- PWA E2E intentado: el servidor falla con `listen EPERM`; Chromium también tiene bloqueado el arranque y WebKit no se pudo descargar por DNS. La suite queda lista en CI, sin atribuirle un resultado aprobado local.
- Commit local bloqueado: `.git` es solo lectura y `git add -A` falla al crear `.git/index.lock`. Sin push ni PR.

## Checklist pendiente en iPhone real

- [ ] Entrar por Safari sin sesión: no debe aparecer invitación durante login/onboarding.
- [ ] Entrar a una tienda y esperar 30 segundos: revisar la guía a 360/390 px y en un teléfono con Dynamic Island.
- [ ] Cerrar la guía y volver/recargar: no debe reaparecer.
- [ ] En un navegador sin descarte previo, Compartir → Agregar a inicio; confirmar Abrir como app web cuando Safari lo ofrece. Revisar ícono, nombre y splash en vertical/horizontal.
- [ ] Abrir desde el ícono: sin barra de navegador ni invitación. Revisar notch, tab bar, formularios y sheets con teclado abierto.
- [ ] Ingresar con email/password; cerrar completamente y reabrir para comprobar persistencia en la app instalada. La sesión del Safari original puede tener almacenamiento separado.
- [ ] Ingresar con Google desde standalone después de autorizar el handler; volver a iManager con una sesión real y tienda resuelta. Probar cancelar/fallar y luego ingresar con email.
- [ ] Sin conexión, reabrir: shell visible y error de conexión. Comprobar que `/api/me` y datos de negocio no aparecen en Cache Storage.
- [ ] Abrir una operación y desplegar una versión nueva: no debe forzar recarga; cerrar todas las ventanas y reabrir para cargar la actualización.
