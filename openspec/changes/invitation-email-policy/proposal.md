## Motivo
Las invitaciones con email hoy aceptan cualquier identidad que posea el enlace. Vincularlas al email verificado del token Firebase según la tarea autorizada.

## Alcance
Normalizar trim + lowercase al crear/comparar, exigir verificación solo en invitaciones con email, conservar enlaces sin email y documentar su riesgo/decisión pendiente. UI recuperable, sin revelar destinatario, y pruebas relacionadas. Sin schema ni migraciones. Entrega por PR a test, sin merge por cambio visible que requiere OK de Matias.
