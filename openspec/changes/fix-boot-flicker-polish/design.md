## Decisions
- Splash externo a React, fondo #F7F8FA, ícono existente y salida única de 100 ms tras resolver auth/sesión y las lecturas iniciales; un observer de `aria-busy`/placeholders coordina la primera pantalla estable. Se reutiliza antes de una recarga visible autorizada.
- Efectos ligados al uid y al scope de tienda/permisos; confirmación del mismo usuario conserva identidad.
- Setters de datos compartidos conservan objetos/filas iguales mediante comparación recursiva sin serialización. Revalidar conserva datos y flags iniciales.
- Eventos de navegación/foco/visibilidad usan una compuerta de 15 s desde la finalización; mensajes de mutación la omiten.
- PWA pendiente solo recarga automáticamente oculta y segura; regreso tras 3 minutos usa splash si aún hay actualización pendiente. Se preserva la guarda por versión.
- Scrim y hoja tienen animaciones independientes para que el contenido móvil permanezca opaco. Skeletons estáticos con revelado a 180 ms.
- Avisos tardíos fuera del flujo y chip de dólar con medidas reservadas.

## Validation
Vitest de helpers, efectos compartidos, skeleton, PWA y compuerta; suite frontend completa, PWA, typecheck frontend/backend y build explícitamente solicitado. Sin E2E.
