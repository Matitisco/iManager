## Design
Mockup previo: `.wireframe-483.png`, generado antes de implementar, con Reclamo y Cliente en escritorio y móvil. Usar DM Sans, tokens y clases `dp-*` existentes, sin subtítulos ni explicaciones redundantes.

Extraer DatePicker del selector de Reportes, con export de compatibilidad. Agregar required, disabled, ariaLabel y error. Mantener display dd/mm/aaaa y callbacks ISO YYYY-MM-DD (borrador parcial disponible para validar). Validar fechas de calendario reales antes de persistir. Cumpleaños y filtros de caja siguen opcionales.

El panel flotante se renderiza fuera de contenedores con transform/overflow y participa en las capas modales existentes; se ancla al campo y se ajusta al viewport. Reportes conserva su variante inline móvil.

## Validation
Vitest del selector y formularios reales con servicios simulados para verificar selección, escritura, errores y payloads; TypeScript frontend/backend. Capturas Playwright locales en 1440 y 390; sin guardar formularios ni escribir bases reales.

## Results
- `npx vitest run --maxWorkers=2`: 171 archivos, 1.316 pruebas aprobadas. Incluye unitarias de fechas, selección/teclado/foco/capas y formularios reales con persistencia simulada (cumpleaños, reclamo, gasto, vigencia, cuotas y filtros de caja).
- `npx tsc --noEmit` en raíz y backend: aprobado. `git diff --check`: aprobado. Ningún input `type=date` restante en `src/`.
- `.shots-483.mjs`: 46 PNG en `.shots-483/`, sin fallos, 1440×900 e iPhone 13 (390×844). Navega con la cuenta local `dueno@imanager.local`; no confirma formularios. Caja y Gastos siguen ocultos por #489: sus componentes reales se capturan en un fixture con contexto sintético y mutaciones bloqueadas, sin modificar flags de la app.
- Reproducción: `SHOTS_DIR=.shots-483 node .shots-483.mjs` (4210 por defecto). En esta sesión 4210 ya servía otro checkout; se usó `SHOTS_APP_URL=http://127.0.0.1:4212/#/` para el Vite de este worktree, con el backend local sembrado existente. También permite `SHOTS_ONLY` y `PREFIX`.
- Mockup generado con la herramienta integrada `image_gen`; prompt completo en `.wireframe-483.prompt.txt`. No build, migraciones, commit, push ni PR. El CLI de OpenSpec no estaba instalado: los cuatro artefactos se mantuvieron manualmente.
