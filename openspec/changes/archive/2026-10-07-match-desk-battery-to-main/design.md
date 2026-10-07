## Context

La referencia es `BatteryCell` de `origin/main:src/pages/Inventory.tsx`. Usa `extractMinBattery`, `batteryColor` y `formatBatteryDisplay`, ya disponibles en esta rama. El indicador hi-fi usa una barra estática con fondo lima y convierte el valor a número antes de renderizarlo.

## Goals / Non-Goals

**Goals:** reproducir colores y animación de `main` y mantener el formato del valor original.

**Non-Goals:** cambiar el diseño de la tabla, el formulario de edición o los helpers compartidos.

## Decisions

- Pasar `batteryHealth` directamente al componente `Battery`, que acepta string o number y usa los helpers compartidos. Evita perder el texto de rangos y la conversión de fracciones decimales.
- Usar `motion.i` con `initial={{ width: 0 }}` y `animate={{ width: porcentaje }}`. Es el mismo comportamiento de `main` con el ancho de barra hi-fi existente.
- Aplicar las clases semánticas de `batteryColor` a la barra y al porcentaje. Eliminar el fondo lima del CSS para que no sobrescriba esas clases.
- Limitar visualmente el ancho a 0–100 sin cambiar el dato guardado.

## Risks / Trade-offs

- El CSS del componente puede prevalecer sobre las clases de Tailwind → retirar el fondo fijo y verificar los colores en el navegador.
- La animación no se comprueba con el mock global de Motion de Vitest → revisar la entrada y un cambio de valor con el componente real en una vista local temporal.

## Migration Plan

Publicar un commit separado en `hifi-desk`. Sin migraciones. Revertir ese commit revierte el indicador.

## Open Questions

Ninguna dentro del alcance de #81.
