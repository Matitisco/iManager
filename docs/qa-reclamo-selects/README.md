# PR #711: un chevron por selector

Seguimiento del 02/11/2026 en `fix/reclamo-ventas-vacias`, contra `test`.

## Causa y corrección

`DeskSelect` dibuja un SVG `ChevronDown` y conserva un `<select>` oculto para validación y FormData. La regla antigua `.return-sheet .fl:has(select)::after` detectaba ese select oculto y agregaba otra flecha sobre la del componente. El padding heredado de 40 px también alteraba el tamaño del nodo oculto. Se retiran las cuatro reglas de select nativo de reclamos, conservando la presentación del componente compartido.

Nuevo reclamo tiene un único selector, Venta; Fecha usa DatePicker y Cantidad es un input. El detalle/resolución utiliza botones Choices. La búsqueda de selects, `appearance`, chevrons y pseudoelementos en `src/` no encontró otra decoración equivalente. Onboarding y los mapeos de importación conservan sus selects existentes.

## Evidencia

La nueva aserción de navegador falla antes del arreglo en ambas resoluciones por el pseudoelemento extra y el tamaño del select oculto. Después pasa: exactamente un SVG, sin decoración generada en campo/control y select nativo recortado a 1×1 px. También se aplica a los DeskSelect visibles durante el recorrido de las 22 rutas de la app a 1440 y 390 px.

| Resolución | Antes | Después |
| --- | --- | --- |
| 1440×900 | [Captura](before/nuevo-reclamo-1440.png) | [Captura](after/nuevo-reclamo-1440.png) |
| 390×844 | [Captura](before/nuevo-reclamo-390.png) | [Captura](after/nuevo-reclamo-390.png) |

Capturas finales inspeccionadas visualmente, con las transiciones terminadas. Los recorridos de reclamos conservan error/reintento, selección, apertura de una unidad de una venta pendiente de tres, persistencia tras recargar y stock restante. Las pruebas de DeskSelect conservan cobertura de teclado, foco, selección y FormData.

Validación: lint frontend/backend; 211 pruebas frontend (68 de selectores/reclamos y 143 de los archivos que leen desk.css); 40 unitarias backend; 24 integraciones de elegibilidad, devoluciones, compras y margen parcial; tres recorridos Playwright (reclamos desktop/mobile y navegación). La generación final de capturas vuelve a pasar los dos recorridos de reclamos.

Bases exclusivamente locales y ficticias en `127.0.0.1:5545`: `imanager_reclamo_test` para integración y `imanager_reclamo_e2e` para Playwright. Sin build. `origin/test` en `a618cfb` ya estaba contenido en la rama; no se necesitaron nuevas resoluciones de conflictos ni se descartaron cambios.

Para reproducir las capturas, definir `DATABASE_URL` con una base de pruebas local y ejecutar:

```bash
RETURN_SALES_SHOTS=docs/qa-reclamo-selects/after npx playwright test e2e/return-sales.spec.ts --workers=1
```
