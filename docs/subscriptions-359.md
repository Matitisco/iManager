# Suscripciones con Mercado Pago — #359

## Acceso y precios

| Plan | Mensual | Anual (un cobro) | Equivalente mensual anual | Miembros |
|---|---|---|---|---|
| Básico | US$ 22 | US$ 198 | US$ 16,50 | 3 |
| Negocio | US$ 87 | US$ 783 | US$ 65,25 | 5 |
| Sistema propio | A medida | A medida | — | A convenir |
| Interno | Gratis de por vida | Gratis de por vida | — | Ilimitados |

La prueba dura exactamente 7 × 24 horas desde la creación de la tienda, sin tarjeta y sin `free_trial` de MP. Permite cinco miembros para probar el equipo. Los límites cuentan todos los roles, incluido el propietario. El owner ve Plan y facturación en Configuración; empleados/socios ven el contador y, al vencer, el aviso de contactar al propietario.

`User.billingLegacy` tiene default true para todas las filas anteriores. El alta de usuario a través de Firebase escribe false; ambos caminos de creación de tienda consultan esa marca. `Store.billingPlan` tiene default INTERNAL. Las cuentas anteriores sin tienda también conservan acceso interno al crearla. No hay SQL de backfill obligatorio, corte por fecha arbitraria ni unicidades nuevas sobre tablas existentes. Todos los campos previos se conservan y `prisma db push` alcanza sin aceptar pérdida de datos.

La vigencia se evalúa en cada escritura del backend y no necesita cron. Si vence con el onboarding incompleto, el owner puede entrar al escritorio en lectura y abrir facturación; no queda atrapado en un paso que ya no puede guardar. Vencer conserva lecturas y rechaza escrituras de inventario, ventas, clientes, caja, importación y demás negocio con 402. Sesión, seguridad, lectura de notificaciones, facturación y cambio de tienda siguen accesibles. El owner puede quitar miembros excedentes; ninguna persona ni dato se borra automáticamente. Invitaciones se validan al crear y al aceptar, con un lock por tienda para el último lugar. El plan interno nunca se bloquea por facturación ni limita usuarios.

El resumen distingue En prueba, Activa, Vencida y Cancelada. La cancelación detiene próximos débitos y conserva el término abonado (o el resto de la prueba). Se puede volver a suscribir al terminar ese término; cambiar de plan con acceso abonado todavía vigente se pospone hasta esa fecha para no generar cobros superpuestos.

## Cotización y operación

Se usa `currentBlueRate()` de `backend/src/lib/blue-rate.ts`: **blue vendedor** desde DolarAPI, igual a la cotización automática existente. No se usa el dólar manual de una tienda para alterar precios compartidos, ni se inventa un valor cuando falla la fuente. La cotización tiene el mismo caché de 15 minutos. Se redondea el total a centavos ARS; el anual cobra USD 198/783 completos convertidos, no doce cargos mensuales.

Variables del backend/Railway (sin valores en el repositorio):

- `MP_ACCESS_TOKEN` obligatorio para operaciones MP. Se lee exclusivamente desde el entorno del proceso backend. No se imprime ni se incorpora a errores.
- `MP_PUBLIC_KEY` obligatoria para el formulario de tarjeta, de la misma aplicación/vendedor/entorno que el access token. Es pública y se entrega en la cotización; no reemplaza al token privado.
- `MP_WEBHOOK_SECRET` opcional. Con valor se exige HMAC-SHA256; sin valor se omite la verificación de firma, pero se reconsulta MP de todas formas. Usar secreto en producción.
- `FRONTEND_URL` HTTPS público, con retorno a `#/plan`.
- `DATABASE_URL` del entorno seleccionado. Mantener TEST separado de producción.

Con variables ya configuradas en el proceso Railway:

```bash
npm --prefix backend run billing:sync
```

Crea Básico/Negocio × mensual/anual (`frequency: 1/12`, `months`, `ARS`). Guarda IDs del vendedor y planes en `BillingPlan`, bajo lock de PostgreSQL para procesos concurrentes. Al reejecutar usa PUT; ante un alta remota interrumpida busca por nombre y URL de retorno para recuperar el ID. Si hay duplicados o cambia el vendedor, falla y requiere revisar la configuración, sin reasignar IDs. No se deben renombrar manualmente estos cuatro planes en MP. La búsqueda de recuperación está limitada a 100 coincidencias; más coincidencias requieren limpieza operativa antes de reintentar.

También actualiza por PUT importes de preapprovals locales no cancelados y reconcilia vigencia. La actualización de contratos es explícita porque actualizar un plan no garantiza actualizar suscriptores existentes. Una falla intermedia termina con código distinto de cero; reejecutar es seguro y completa las operaciones pendientes. El script imprime solo conteos; no exporta filas, datos comerciales ni respuestas del proveedor.

Ejecutarlo diariamente desde un cron/servicio Railway con las mismas variables y alertar sobre salida no cero. La frecuencia final queda para operación. Antes de cada cotización de checkout, el backend ajusta el plan seleccionado si el blue cambió, guarda el precio/email en una cotización de 10 minutos y exige confirmación. Antes de crear la suscripción verifica nuevamente plan, monto, moneda/frecuencia y cotización. Si cambian o vence el presupuesto devuelve 409 y pide volver a consultar.

## API y webhook

| Ruta | Acceso | Función |
|---|---|---|
| GET `/api/billing` | Owner | Plan actual, acceso y catálogo USD |
| POST `/api/billing/quote` | Owner | `{key, payerEmail}` → importe ARS, quote ID y publicKey |
| POST `/api/billing/checkout` | Owner | `{quoteId, cardTokenId}` → estado del alta, aislada por tienda |
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

## Checkout propio y sandbox

La pantalla, textos, colores y botones pertenecen a iManager. Solo se aceptan tarjetas; no hay login ni cuenta de Mercado Pago en el recorrido. MercadoPago.js se carga desde `https://sdk.mercadopago.com/js/v2` únicamente al abrir el formulario. Secure Fields aísla número, vencimiento y CVV en iframes del proveedor, estilizados con superficies claras, texto de 16 px y controles de 48 px para evitar zoom de iPhone. Nombre/documento del titular se envían directamente al SDK para tokenizar. El email procede de la cotización confirmada y no se reemplaza desde el submit.

El backend recibe únicamente `quoteId` y `cardTokenId`, y crea `POST /preapproval` con `preapproval_plan_id`, `card_token_id`, `payer_email`, `external_reference=storeId`, `back_url` y `status=authorized`. Nunca persiste el token ni PAN/CVV/vencimiento. No devuelve ni navega a `init_point`; ese campo permanece en el catálogo histórico por compatibilidad de datos, sin intervenir en el checkout. La autorización por sí sola no concede acceso pagado: se reconsulta el contrato y se espera evidencia del cobro.

Un intento durable se guarda como CREATING antes del POST. La fase del POST toma nuevamente locks de catálogo/tienda, revalida precio/plazo y mantiene el precio estable durante el alta. Al recibir respuesta se guarda solo el ID del contrato (CREATED), y al reconciliar se marca RESOLVED. Doble envío, recarga o nueva cotización no pueden generar otro cobro mientras el intento está en proceso. Un rechazo explícito pasa a FAILED; la UI pide otra cotización y genera un token nuevo. Ante timeout o respuesta inválida, se conserva el bloqueo y Actualizar estado del pago recupera el ID desde MP por referencia/email; el webhook también puede resolverlo. Si MP no devuelve ningún contrato tras un resultado incierto, operación debe revisar el intento antes de habilitar otro: no se reenvía automáticamente.

Errores de SDK, conexión, tarjeta o backend se muestran en español. Los campos inválidos se pueden corregir sin abandonar la pantalla; un error del alta invalida la cotización para evitar reutilizar el token. La UI informa solicitud enviada y espera la confirmación del cobro, sin mostrar pago exitoso prematuramente.

Referencias oficiales:

- [Crear suscripción con plan y tarjeta tokenizada](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/create-preapproval/post).
- [Secure Fields del SDK oficial: montaje, estilo y tokenización](https://github.com/mercadopago/sdk-js/blob/main/docs/fields.md).
- [Webhook y firma](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks).

**Prueba real pendiente:** esta sesión no dispone de las credenciales MP de vendedor/comprador. Las pruebas automatizadas simulan HTTP MP y el SDK con iframes; verifican el contrato de integración y el comportamiento responsive, pero no acreditan un débito real ni la autorización del proveedor. No se consultaron secretos ni filas de Railway.

Para cerrar la validación en un entorno TEST separado:

1. Configurar `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY` de la misma aplicación TEST y sincronizar los planes.
2. Crear una tienda nueva, ingresar el email del comprador TEST y confirmar el total ARS.
3. Desde Safari/iPhone y desktop, sin sesión de MP, completar Secure Fields con tarjeta TEST y confirmar en iManager. Verificar que los iframes reales carguen y permitan teclado, vencimiento y CVV de 3/4 dígitos, y que la pantalla conserve su UI.
4. Reconsultar preapproval y comprobar plan, external_reference y payer_email. Verificar el cargo confirmado, webhook, acceso y cancelación.
5. Verificar tarjeta rechazada, error de conexión, renovación y reintento sin duplicados. No registrar tokens, PAN/CVV ni cuerpos del proveedor en la evidencia.

## Validación reproducible

Bases PostgreSQL locales sintéticas separadas: `imanager_359_migration`, `imanager_359_integration` e `imanager_359_e2e`. La prueba de schema aplicó el schema previo, creó cuenta/tienda/membresía/equipo y ejecutó db push actual sin aceptar pérdida; verificó defaults y conservación de importes mediante assertions SQL, sin exportaciones.

```bash
timeout 900 npm run lint
timeout 900 npm --prefix backend run lint
timeout 900 npm run build
timeout 900 npm --prefix backend run build
timeout 900 npm run test:frontend -- --maxWorkers=2
timeout 900 npm --prefix backend run test:unit -- --maxWorkers=2
DATABASE_URL=<base-local-integration> timeout 900 npm --prefix backend run test:integration -- src/test/billing.integration.test.ts
DATABASE_URL=<base-local-e2e> PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3359 PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4359 timeout 900 npm run test:e2e -- e2e/billing.spec.ts e2e/billing-iphone.spec.ts --workers=2
```

Se ejecutan únicamente los specs Playwright afectados, nunca la suite completa. `ISSUE_359_SHOTS=docs/pr-shots` habilita solo capturas de esta issue. Las capturas versionadas son anteriores a estos ajustes y muestran el checkout hospedado; el recorrido actual se verifica con los specs indicados. Esta revisión no versiona capturas ni artefactos nuevos. Los E2E verifican prueba/cupos, precios, ARS/email, tokenización con error corregible, solicitud de alta sin navegación, vencimiento, cancelación e interno. Las integraciones verifican HTTP MP, aislamiento, límites concurrentes y recuperación de solicitudes.

Resultados de los ajustes: lint y builds de frontend/backend aprobados; 769 unitarios frontend, 414 unitarios backend, 32 integraciones de facturación y cuatro E2E afectados (desktop/WebKit iPhone) aprobados, sin retries. Todas las pruebas se ejecutaron con timeout 900. Se inspeccionaron capturas temporales de ambas pantallas. Base adicional `imanager_359_adjust_schema`: db push desde el schema anterior con tienda y cotización existentes; assertions confirman importe/email/default QUOTED e ID remoto null conservados, sin aceptar pérdida de datos. Los dos campos nuevos de BillingCheckout son aditivos, uno con default QUOTED y otro nullable, sin nuevas unicidades ni cambios a columnas existentes.

## DECISIONES PENDIENTES

- Validar en MP TEST los Secure Fields reales, el pago con tarjeta sin cuenta MP desde iPhone y desktop, external_reference y coincidencia del email; configurar la public key junto al access token. Bloquea habilitar cobros productivos hasta completar esa validación.
- Confirmar cron y alerta operativa para sincronización diaria de precios/contratos y reconciliación.
- Definir con producto el aviso previo a cambios de monto ARS de renovaciones; la pantalla ya informa el ajuste por cotización.
- Confirmar experiencia comercial de cambios de plan al finalizar el período abonado y contacto de Sistema propio.
- La landing pública no vive en este repositorio; mantener allí los mismos precios USD al publicar.
