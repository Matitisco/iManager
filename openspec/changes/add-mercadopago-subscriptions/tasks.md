## 1. Backend y datos
- [x] 1.1 Agregar schema aditivo y comprobar db push sobre datos previos.
- [x] 1.2 Implementar catálogo MP y script idempotente de precios/reconciliación.
- [x] 1.3 Implementar cotización, checkout y cancelación owner con aislamiento por tienda.
- [x] 1.4 Implementar webhook, firma y reconciliación de vigencia/email.
- [x] 1.5 Integrar prueba/legacy en altas, sesión, límites concurrentes y guard de escritura.

## 2. Frontend
- [x] 2.1 Tipos y servicio HTTP; integrar estado de facturación en sesión/AppContext.
- [x] 2.2 Pantalla owner de plan/facturación, confirmación ARS, cancelación y errores.
- [x] 2.3 Contador en Dashboard y aviso de solo lectura en iPhone/desktop.

## 3. Validación y entrega
- [x] 3.1 Unitarios y backend integración con HTTP MP simulado.
- [x] 3.2 Playwright desktop/iPhone y capturas docs/pr-shots/issue-359-*.png.
- [ ] 3.3 Lint, builds, npm test, backend tests y E2E completos.
- [x] 3.4 Documentar entorno, operación, decisiones pendientes y evidencia sandbox disponible.
- [ ] 3.5 Validar en MP TEST real tarjeta como invitado, external_reference y email coincidente (requiere token/vendedor y acceso de comprador no disponibles en esta sesión).
- [ ] 3.6 Commit en español, push de feat/359-suscripciones-mp y PR sin merge.
