# QA: «Canje como parte de pago»

## Qué encontré, en criollo

No pude reproducir un botón roto. En el celular, **«Canje como parte de pago» abre y cierra una sección; no activa el canje**. Adentro está «Tiene canje», que es lo que realmente lo incluye. Se puede abrir cinco veces y después confirmar una venta común: eso funciona así hoy.

Sí había una confusión visual concreta: el encabezado decía siempre lo mismo, incluso si había un canje activo adentro y se cerraba la sección. Agregué solamente **«Sin canje» / «Con canje»**, este último resaltado. Abrir la sección sigue sin activar el checkbox. No cambié handlers, estados, cálculos, validaciones, payloads, persistencia ni stock.

Esto es compatible con la señal de rage click reportada, pero **no demuestra la intención del cliente ni la causa exacta de esa sesión de PostHog**. La reproducción usa datos ficticios y el formulario real en local.

## Reproducción y resultados

- Base: `origin/test` (`26b0e1b`), worktree `fix/canje-toggle`, limpio al iniciar. #691 se conserva.
- Playwright Chromium, mobile con `isMobile` y `hasTouch`, 390 × 844 y 360 × 844; desktop 1440 × 900. Click y tap reales de Playwright, sin `dispatchEvent` ni clicks forzados.
- Cinco gestos cada 400 ms (~1,6 s del primero al quinto), a **las mismas coordenadas físicas**. Cada gesto alterna el estado esperado; desplazamiento vertical del control menor a 1 px.
- En mobile: cinco clicks → cinco `toggle`; cinco taps → cinco `touchend`, cinco clicks de compatibilidad y cinco `toggle`. No hay handler táctil que duplique la acción.
- En desktop: cinco cambios del checkbox. El `label` nativo reenvía un click al input: hay dos eventos DOM por click en el label, pero **un solo `change` y un solo cambio de estado**.
- Sin overlay que intercepte el punto probado (`elementFromPoint`), sin pérdida de selección al editar Cliente, sin reset al cerrar/reabrir el panel; el equipo recibido conserva su texto. No se observó lag visible en este entorno: la comprobación del estado tras el gesto tardó 13–78 ms en la primera pasada con el indicador. No es un benchmark de dispositivos físicos ni prueba de rendimiento de producción.

| Control | Área medida | Resultado |
| --- | --- | --- |
| Encabezado mobile 390 | 356 × 44 px | Toda la fila responde, sin desplazamiento durante los cinco gestos |
| Encabezado mobile 360 | 326 × 44 px | Cabe completo, sin desborde horizontal |
| Label del checkbox desktop | 484 × 17 px; checkbox 16 × 16 | Responde también al pulsar el texto o el resto del label; altura pequeña, conservada en este cambio de feedback |

### Guardado real, solo en PostgreSQL local

Fixture mayorista: stock de 20 unidades a 650 ARS; venta de tres unidades (1.950 ARS).

- Activando el checkbox: una venta y un canje, valor tomado 500, diferencia 1.450, vínculo correcto y stock final 17.
- Cinco aperturas/cierres del panel sin marcar el checkbox y luego «Confirmar venta»: una sola venta, `tradeInId: null`, cero canjes y stock final 17. Probado con click y tap en ambos anchos móviles.

DB descartable exclusiva `qa_canje_toggle` en `127.0.0.1:55461`, API/frontend en loopback, auth de E2E y cotización ficticia. Sin producción, DB real, build local ni cambios de permisos.

## Pruebas

- **Antes del cambio de UI:** seis recorridos funcionales pasan (tres anchos × click/tap).
- **Rojo de feedback:** la nueva prueba de componente falla porque esperaba «Sin canje» y encontraba solo «Canje como parte de pago»; las otras diez pruebas del archivo pasan. Es una mejora de feedback, no un supuesto fallo funcional arreglado.
- **Verde:** once pruebas de edición de venta/canje y 447 pruebas frontend relacionadas pasan.
- Diez recorridos Chromium del nuevo archivo pasan con el indicador. Incluyen el caso exacto de cinco gestos → confirmar venta común.
- TypeScript frontend, backend y archivo E2E verificados. CI del PR es el control final antes del merge a `test`.
- Intento adicional de WebKit: no llegó a ejecutar los recorridos porque al runtime le faltan bibliotecas Linux. La cobertura comprobada es Chromium con emulación táctil; no se afirma validación en Safari ni en un teléfono físico.

El archivo reproducible es [`e2e/sale-trade-toggle.spec.ts`](../e2e/sale-trade-toggle.spec.ts). Requiere una DB **local descartable** preparada; el setup de Playwright aplica el schema en ella:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55461/qa_canje_toggle \
PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4188 \
PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3188 \
npx playwright test e2e/sale-trade-toggle.spec.ts --workers=2
```

## Capturas ficticias

| Antes | Después: sin canje | Después: con canje y panel cerrado |
| --- | --- | --- |
| ![390 antes](qa-canje-toggle/390-before.png) | ![390 sin canje](qa-canje-toggle/390-without-trade.png) | ![390 con canje](qa-canje-toggle/390-with-trade.png) |
| — | ![360 sin canje](qa-canje-toggle/360-without-trade.png) | ![360 con canje](qa-canje-toggle/360-with-trade.png) |

[Checkbox de desktop](qa-canje-toggle/1440-checkbox.png).
