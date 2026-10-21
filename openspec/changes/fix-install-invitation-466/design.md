# Design

## Context
Base `8115347`, 2026-10-21. Reproducción por código y 29 pruebas PWA existentes aprobadas. No se dispone de sesión productiva para reproducir la app autenticada servida; no se escribe ni se despliega en producción. Las capturas usarán Vite sin service worker y API simulada, evitando caché PWA.

## Goals / Non-Goals
Implementar el diseño aprobado de #466 con cambios exclusivamente frontend; preservar navegación de #450, permisos, conteos de onboarding y persistencia de negocio.

## Decisions
- Preferencia por navegador/origen `imanager:install-preference:v2`: version 2, dismissedForever y snoozedUntil. Migrar cualquiera de las claves históricas preservando el descarte. Borrar las anteriores sólo después de escribir correctamente. Fallback en memoria si almacenamiento falla.
- Suscripción compartida: eventos internos/storage, vuelta de pestaña y timer al vencimiento; consumidores con snapshots primitivos estables.
- Separar instalación real (standalone/appinstalled), preferencia y prompt consumible. requestInstall devuelve accepted/dismissed/unavailable. Cierre nativo aplaza siete días; aceptación suprime la invitación durante esta sesión, sin afirmar instalación terminada.
- Elegibilidad: habilitado por sesión, Dashboard, móvil por plataforma y breakpoint 760px, pestaña visible, sin instalación real, aceptación pendiente, descarte vigente ni formulario/modal visible. Esperar 30 segundos continuos y reiniciar ante cualquier bloqueo. Sin animación de salida que retenga el banner.
- Observador con useSyncExternalStore para form, role=dialog y .ov, comprobando ocultamiento propio/ancestros; desconectar al desmontar. No observar cambios de estilo de cada animación: recalcular sólo la condición booleana.
- Banner blanco en flujo; Safari con Compartir/Agregar a inicio, otro iOS con abrir en Safari, Android manual o CTA nativo. Aviso negro temporal con check verde sobre navegación, sin enlaces tras descarte permanente salvo Ayuda.
- InstallCard se oculta por descarte permanente, desktop o instalación real sin tocar estructura de Más. Primeros pasos mantiene total/progreso pero reemplaza su acción de instalación por referencia a Ayuda después del descarte permanente.

## Risks / Trade-offs
Una pestaña normal no puede detectar universalmente una instalación previa. WebKit emulado no acredita instalación física en Safari. Se testean standalone, appinstalled, eventos nativos simulados, foco, layout y persistencia; no se cambian service worker, backend ni DB.

## Migration Plan
Migración local y conservadora al leer preferencias; sin migraciones Prisma. Revertir el frontend no borra el registro v2.

## Open Questions
Ninguna: plan y diseño autorizados por el usuario.
