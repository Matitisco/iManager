# Onboarding y Primeros pasos (#344)

El recorrido de una cuenta nueva sigue nombre → video opcional → invitación opcional → stock. El nombre es el único dato obligatorio; USD y dólar blue automático quedan plegados. La etapa persiste en la tienda y se retoma al recargar. Las tiendas existentes conservan las fechas de onboarding en null y entran a su Dashboard habitual.

## Video

Configurar `VITE_WELCOME_VIDEO_SRC` con la URL del archivo producido por iManager Videos y reconstruir el frontend. `VITE_WELCOME_VIDEO_POSTER` es opcional; por defecto usa `/welcome-poster.svg`. El reproductor no monta ni descarga el archivo hasta pulsar reproducir, usa `preload="none"`, controles nativos y reproducción inline. Si falta el archivo o falla, el usuario puede seguir; Ayuda conserva el acceso desde Cuenta y Más. Se registra como visto al terminar, no al abrir.

## Inventario y revisión

Reutiliza el endpoint de análisis de #338, su validación, normalización, cuotas y chunks. El header `Accept: application/x-ndjson` habilita avances reales; los clientes actuales conservan JSON. El análisis no escribe inventario. La revisión suma cantidades y muestra USD/ARS con la cotización disponible, sin simular conversiones si falta. Las dudas no bloquean guardar y se conservan en `customFields.onboardingReview`; la ficha permite marcarlas revisadas. Ante guardado parcial, el reintento envía solo las filas fallidas.

Excel y carga manual reutilizan los componentes existentes. Ninguna ruta nueva exporta filas.

## Checklist y muestras

Primeros pasos muestra solamente pendientes, con progreso que cuenta también los completados. Stock, ventas, equipo y catálogo se derivan de datos reales y permisos. Una invitación enviada sigue pendiente hasta que se suma una persona; el formulario y los roles son los existentes. Instalación reutiliza la guía PWA para iPhone y Android; se completa por instalación detectada. El descarte, la instalación y el video se guardan por membresía y pueden consultarse desde Ayuda.

Las muestras usan `InventoryItem.sampleBatchId`, asignado exclusivamente por el servidor. Su creación y borrado usan transacciones con lock por tienda. La confirmación elimina únicamente filas con esa marca en la tienda autenticada; no usa nombres, IMEI ni customFields para decidir qué borrar. Los ejemplos no completan el paso de carga de stock real.

## Prisma y pruebas

Los campos agregados son nullable o tienen default; no se agrega ninguna unicidad a tablas existentes. El despliegue sigue usando `prisma db push` sin aceptar pérdida de datos.

Las pruebas de navegador comparten casos para desktop 1440×900 e iPhone 13/WebKit. Simulan el endpoint de análisis y el archivo de video; sesión, invitación, importación y borrado usan el backend y PostgreSQL reales. Incluyen recorrido, omisiones, reanudación, errores parcial/inválido, muestras, revisión y acceso de cuentas existentes desde Ayuda.

Ejecutar con puertos y base exclusivos para evitar interferencia con otros checkouts:

```sh
PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4344 PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3344 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_344_e2e npm run test:e2e -- e2e/onboarding.spec.ts e2e/onboarding-iphone.spec.ts --workers=1
```

Las capturas del resultado y del Dashboard vacío quedan en `test-results/` por plataforma.
