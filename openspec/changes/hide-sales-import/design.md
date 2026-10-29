# Diseño

Centralizar `IMPORT_SALES_ENABLED: boolean = false` en `src/config/featureFlags.ts`. Condicionar desktop/mobile y el despachador de overlays; inventario y clientes conservan sus accesos. No existen entradas adicionales en menús, atajos ni onboarding.
