## Design
Mockup previo generado con image_gen: `.wireframe-483.png` (desktop y mobile). Mantener DM Sans, tokens y componentes existentes, sin agregar texto secundario.

Activar un límite de posición al cuerpo del Sheet solo para la fecha de Editar Venta. Conservar el portal fuera del overflow y las capas de foco. Intersectar el cuerpo con el viewport visual; abrir debajo o encima, desplazar mínimamente el formulario al abrir si hace falta y limitar la altura en espacios reducidos. Recalcular al hacer scroll, resize o terminar la animación de apertura. Cerrar si el campo sale del área visible.

## Validation
Vitest: geometría pura, componente dentro de Sheet e integración con Editar Venta y su payload. TypeScript y capturas locales en ambos tamaños, sin guardar formularios en bases reales.

## Results
- 63 pruebas aprobadas en 7 archivos: posición, DatePicker, compatibilidad de Reportes, edición de vendedor/venta, canje, capas modales y formularios de fecha.
- `npx tsc --noEmit` aprobado en frontend y backend. `git diff --check` aprobado.
- 6 capturas en `.shots-483/`: edición, calendario abierto y scroll en desktop 1440×900 e iPhone 13 (390 px). Panel a 8 px del campo, dentro del cuerpo del modal y viewport; ninguna etapa fallida.
- Script `.shots-483.mjs` usa 4210 por defecto y permite `SHOTS_APP_URL`. Verificación de este worktree: `SHOTS_DIR=.shots-483 SHOTS_APP_URL=http://127.0.0.1:4212/#/ node .shots-483.mjs`, porque 4210 ya servía otro checkout. Se usó el backend local sembrado existente; no se guardaron formularios.
- Mockup generado antes del código con la herramienta integrada image_gen; prompt en `.wireframe-483-b.prompt.txt`. Sin build, cambios de backend/esquema, commit, push ni PR.

## Corrección de viewport bajo (punto 16)
A 1440×620, el cuerpo del modal mide 361 px y el calendario requiere 373 px: desplazar el formulario nunca puede hacerlo entrar. La función pura recibe también los límites del viewport visual; si el cuerpo no permite mostrar el panel completo, lo ubica al costado del campo cuando hay ancho, o lo voltea/reubica dentro del viewport. El scroll propio del calendario queda reservado para un viewport menor que el panel. La medición incluye contenido y bordes aun después de aplicar maxHeight, y se recalcula con ResizeObserver, scroll y resize. En móvil se conserva `dp-inline` y se desplaza solo `.sheet-scroll` al abrir para revelar el calendario. Sin CSS, tokens, textos ni dependencias nuevos.

Validación completada: regresión pura y de componente, suites completas con reintento de timeouts locales, TypeScript y capturas antes/después a 1440×620, 1440×900 y 390×844 sobre DB ficticia dedicada `imanager_483b`, API 3380 / web 4380. Evidencia y límites en `docs/qa-483/calendario-editar-venta.md`.
