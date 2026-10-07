## Context

`Login` ya resetea la carga en `finally`, pero Firebase espera un evento de autenticación antes de rechazar un popup cerrado. La interfaz queda bloqueada durante esa espera. Login y registro usan el mismo handler de Google.

## Goals / Non-Goals

**Goals:** recuperar la interacción al volver al formulario, permitir reintentos seguros y seguir mostrando errores reales.

**Non-Goals:** cambiar Firebase, detectar el contenido de ventanas externas, crear usuarios sin autenticación o modificar otros issues.

## Decisions

- Escuchar `focus` y el regreso a `visibilityState=visible` mientras `Login` está montado para liberar únicamente la carga visual de Google. La promesa y el estado real de sesión siguen en manos de Firebase. Esperar solo el rechazo mantiene la demora actual; un timeout podría cortar un login legítimamente lento.
- Identificar cada intento con un contador en `useRef`. Solo el último puede actualizar el error y finalizar la carga. Esto evita que el rechazo diferido del popup previo altere un reintento.
- Omitir errores visibles por `auth/popup-closed-by-user` y `auth/cancelled-popup-request`; preservar mensajes de bloqueo, red y otros errores.
- Quitar listeners e invalidar el intento al desmontar el formulario.

## Risks / Trade-offs

- Volver al formulario con el popup todavía abierto también libera la carga visual → un reintento sigue usando `signInWithPopup`, que cancela su operación previa; el contador ignora sus respuestas tardías.
- Las pruebas unitarias simulan eventos del navegador y la promesa de Firebase → validan la recuperación y sus carreras, pero no sustituyen una sesión real con Google.

## Migration Plan

Publicar el cambio frontend en `hifi-desk`. No requiere migraciones ni configuración. Se puede revertir el commit para volver al comportamiento previo.

## Open Questions

Ninguna dentro del alcance del issue #62.
