# Suscripciones con Mercado Pago — #359

## Acceso y precios

| Plan | Mensual | Anual (un cobro) | Equivalente mensual anual | Miembros |
|---|---|---|---|---|
| Básico | US$ 22 | US$ 198 | US$ 16,50 | 1 |
| Negocio | US$ 87 | US$ 783 | US$ 65,25 | 3 |
| Sistema propio | A medida | A medida | — | A convenir |
| Interno | Gratis de por vida | Gratis de por vida | — | Ilimitados |

La prueba dura exactamente 7 × 24 horas desde la creación de la tienda, sin tarjeta y sin `free_trial` de MP. Permite tres miembros para probar el equipo. Los límites cuentan todos los roles, incluido el propietario. El owner ve Plan y facturación en Configuración; empleados/socios ven el contador y, al vencer, el aviso de contactar al propietario.

`User.billingLegacy` tiene default true para todas las filas anteriores. El alta de usuario a través de Firebase escribe false; ambos caminos de creación de tienda consultan esa marca. `Store.billingPlan` tiene default INTERNAL. Las cuentas anteriores sin tienda también conservan acceso interno al crearla. No hay SQL de backfill obligatorio, corte por fecha arbitraria ni unicidades nuevas sobre tablas existentes. Todos los campos previos se conservan y `prisma db push` alcanza sin aceptar pérdida de datos.

La vigencia se evalúa en cada escritura del backend y no necesita cron. Si vence con el onboarding incompleto, el owner puede entrar al escritorio en lectura y abrir facturación; no queda atrapado en un paso que ya no puede guardar. Vencer conserva lecturas y rechaza escrituras de inventario, ventas, clientes, caja, importación y demás negocio con 402. Sesión, seguridad, lectura de notificaciones, facturación y cambio de tienda siguen accesibles. El owner puede quitar miembros excedentes; ninguna persona ni dato se borra automáticamente. Invitaciones se validan al crear y al aceptar, con un lock por tienda para el último lugar. El plan interno nunca se bloquea por facturación ni limita usuarios.

El resumen distingue En prueba, Activa, Vencida y Cancelada. La cancelación detiene próximos débitos y conserva el término abonado (o el resto de la prueba). Se puede volver a suscribir al terminar ese término; cambiar de plan con acceso abonado todavía vigente se pospone hasta esa fecha para no generar cobros superpuestos.

## Cotización y operación

Se usa `currentBlueRate()` de `backend/src/lib/blue-rate.ts`: **blue vendedor** desde DolarAPI, igual a la cotización automática existente. No se usa el dólar manual de una tienda para alterar precios compartidos, ni se inventa un valor cuando falla la fuente. La cotización tiene el mismo caché de 15 minutos. Se redondea el total a centavos ARS; el anual cobra USD 198/783 completos convertidos, no doce cargos mensuales.

Variables del backend/Railway (sin valores en el repositorio):

- `MP_ACCESS_TOKEN` obligatorio para operaciones MP. Se lee exclusivamente desde el entorno del proceso backend. No se imprime ni se incorpora a errores.
- `MP_WEBHOOK_SECRET` opcional. Con valor se exige HMAC-SHA256; sin valor se omite la verificación de firma, pero se reconsulta MP de todas formas. Usar secreto en producción.
- `FRONTEND_URL` HTTPS público, con retorno a `#/plan`.
- `DATABASE_URL` del entorno seleccionado. Mantener TEST separado de producción.

Con variables ya configuradas en el proceso Railway:

```bash
npm --prefix backend run billing:sync
```

Crea Básico/Negocio × mensual/anual (`frequency: 1/12`, `months`, `ARS`). Guarda IDs del vendedor y planes en `BillingPlan`, bajo lock de PostgreSQL para procesos concurrentes. Al reejecutar usa PUT; ante un alta remota interrumpida busca por nombre y URL de retorno para recuperar el ID. Si hay duplicados o cambia el vendedor, falla y requiere revisar la configuración, sin reasignar IDs. No se deben renombrar manualmente estos cuatro planes en MP. La búsqueda de recuperación está limitada a 100 coincidencias; más coincidencias requieren limpieza operativa antes de reintentar.

También actualiza por PUT importes de preapprovals locales no cancelados y reconcilia vigencia. La actualización de contratos es explícita porque actualizar un plan no garantiza actualizar suscriptores existentes. Una falla intermedia termina con código distinto de cero; reejecutar es seguro y completa las operaciones pendientes. El script imprime solo conteos; no exporta filas, datos comerciales ni respuestas del proveedor.

Ejecutarlo diariamente desde un cron/servicio Railway con las mismas variables y alertar sobre salida no cero. La frecuencia final queda para operación. Antes de cada cotización de checkout, el backend ajusta el plan seleccionado si el blue cambió, guarda el precio/email en una cotización de 10 minutos y exige confirmación. Antes de navegar verifica nuevamente plan, monto, moneda/frecuencia y cotización. Si cambian o vence el presupuesto devuelve 409 y pide volver a consultar.

## API y webhook

| Ruta | Acceso | Función |
|---|---|---|
| GET `/api/billing` | Owner | Plan actual, acceso y catálogo USD |
| POST `/api/billing/quote` | Owner | `{key, payerEmail}` → importe ARS y quote ID |
| POST `/api/billing/checkout` | Owner | `{quoteId}` → initPoint, aislado por tienda |
| POST `/api/billing/refresh` | Owner | Reconsultar pago y recuperar checkout pendiente |
| POST `/api/billing/cancel` | Owner | Cancelación confirmada por MP e idempotente |
| POST `/webhooks/mercadopago` | Proveedor | Firma opcional y reconciliación remota |

En MP configurar `subscription_preapproval` y `subscription_authorized_payment` con la URL pública HTTPS del backend + `/webhooks/mercadopago`. El webhook valida:

```
id:<data.id en minúsculas>;request-id:<x-request-id>;ts:<ts>;
```

Compara HMAC-SHA256 en tiempo constante. Rechaza firmas mal formadas o discrepancia entre ID de query y cuerpo antes de consultar MP. Nunca toma un estado del cuerpo como fuente de verdad. Consulta GET `/preapproval/{id}`; para facturas obtiene primero GET `/authorized_payments/{id}` y luego el preapproval. Fallos remotos devuelven 5xx para reintentar. Tipos desconocidos se reconocen sin mutar datos.

La vinculación requiere external_reference de la tienda, ID de uno de los cuatro planes locales, moneda/frecuencia y email remoto coincidentes con un checkout confirmado por ese owner. Email ausente o distinto no habilita el acceso. Se guarda email normalizado en minúsculas. El navegador nunca elige un ID de preapproval para activar/cancelar otra tienda. El estado interno es inmune al webhook.

Vigencia pagada: `summarized.charged_quantity > 0` y `last_charged_date` válido + 1/12 meses calendario, con clamp al fin de mes. No se toma `next_payment_date` como evidencia de pago. Un `authorized` todavía sin cobro confirmado conserva solo la prueba restante. Duplicados y fechas anteriores no retroceden vigencia; cancelar es terminal para ese contrato. Locks por tienda serializan cancelaciones, altas y webhooks.

## Checkout hospedado y sandbox

Se usa el `init_point` de `preapproval_plan` agregando `external_reference=storeId` y `payer_email` normalizado, sin capturar tarjetas ni crear una suscripción con plan sin `card_token_id`. Solo se permiten enlaces HTTPS del checkout de Mercado Pago Argentina.

Referencias oficiales consultadas:

- [Suscripción con plan asociado](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-associated-plan): el alta directa por API con plan requiere token de tarjeta y autorización. Por eso este flujo usa el enlace hospedado del plan.
- [API de consulta de suscripciones](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-preapproval/get) y [tipos del SDK oficial](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/preApproval/commonTypes.ts): datos del pagador y resumen de cobros.
- [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks): firma y consulta del recurso notificado.

**Prueba real pendiente:** el entorno de trabajo no dispone de `MP_ACCESS_TOKEN` ni del acceso de comprador TEST. No se accedieron secretos ni filas de Railway. La credencial configurada allí no está inyectada en esta sesión. Las pruebas automatizadas simulan la frontera HTTP de MP; no acreditan un pago real ni la posibilidad de checkout como invitado. Tampoco se da por confirmado que MP propague external_reference/payer_email enviados en el enlace: la activación exige la comprobación remota.

Para cerrar esa validación, desde un entorno TEST con el token del vendedor:

1. Sincronizar planes y abrir una tienda de prueba nueva con owner.
2. Usar comprador `TESTUSER4251828252089621044` y vendedor `TESTUSER8428351592468710685` en perfiles separados; obtener el email real de prueba del comprador desde MP y poner exactamente ese email en iManager.
3. En iPhone y desktop, confirmar el total ARS e intentar pagar con tarjeta de prueba **sin iniciar sesión en MP**. Registrar si MP permite invitado o fuerza login.
4. Verificar en GET preapproval que external_reference sea la tienda, el plan sea el elegido y el payer_email coincida. Confirmar cargo exitoso, webhook y acceso activo.
5. Verificar rechazo de otro email, renovación y cancelación. No imprimir tokens, datos de tarjeta ni exportaciones de filas en la evidencia.
6. Si el hospedado obliga a cuenta o descarta la referencia, resolver con producto/proveedor antes de habilitar ventas; no sustituir silenciosamente por otra pasarela ni relajar la validación.

## Validación reproducible

Bases PostgreSQL locales sintéticas separadas: `imanager_359_migration`, `imanager_359_integration` e `imanager_359_e2e`. La prueba de schema aplicó el schema previo, creó cuenta/tienda/membresía/equipo y ejecutó db push actual sin aceptar pérdida; verificó defaults y conservación de importes mediante assertions SQL, sin exportaciones.

```bash
npm run lint
npm --prefix backend run lint
npm run build
npm --prefix backend run build
npm test
npm --prefix backend test
DATABASE_URL=<base-local-integration> npm --prefix backend run test:integration
DATABASE_URL=<base-local-e2e> PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3359 PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4359 npm run test:e2e -- --workers=2
```

Capturas reproducibles con `ISSUE_359_SHOTS=docs/pr-shots` y los specs `e2e/billing.spec.ts e2e/billing-iphone.spec.ts`. Prueban prueba, planes mensual/anual, confirmación ARS/email antes de navegar, enlace del plan, vencimiento real de backend, cancelación con error/reintento y plan interno. Los endpoints MP de checkout/cancelación se simulan en Playwright; las integraciones verifican su contrato HTTP con base real.

## DECISIONES PENDIENTES

- Validar en MP TEST el pago con tarjeta como invitado, propagación de external_reference y coincidencia real del email. Bloquea habilitar cobros en producción si no se cumple.
- Confirmar cron y alerta operativa para sincronización diaria de precios/contratos y reconciliación.
- Definir con producto el aviso previo a cambios de monto ARS de renovaciones; la pantalla ya informa el ajuste por cotización.
- Confirmar experiencia comercial de cambios de plan al finalizar el período abonado y contacto de Sistema propio.
- La landing pública no vive en este repositorio; mantener allí los mismos precios USD al publicar.
