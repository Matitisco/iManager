# Reporte por mail: activación y operación

Issue #374. Mail variante 1 y configuración variante 2. No se configuró un proveedor, no se crearon servicios y no se enviaron correos reales durante la implementación.

## Pasos para Matias

1. En Resend, agregar y verificar un dominio propio (por ejemplo un subdominio de correo). Publicar los registros SPF y DKIM que indica Resend, y DMARC según la política del dominio. Crear una API key limitada al envío para ese dominio. No guardar claves en el repo.
2. Configurar en la API **y en el proceso que ejecutará el cron**:

   | Variable | Valor |
   |---|---|
   | `SMTP_HOST` | `smtp.resend.com` |
   | `SMTP_PORT` | `587` (STARTTLS), o `465` (TLS implícito) |
   | `SMTP_USER` | `resend` |
   | `SMTP_PASS` | API key de Resend |
   | `SMTP_FROM` | `iManager <reportes@dominio-verificado>` |
   | `REPORT_APP_URL` | URL pública HTTPS de la app, sin hash; fallback `FRONTEND_URL` |
   | `DATABASE_URL` | Base PostgreSQL de la aplicación; misma base para API y cron |
   | `REPORT_MAIL_ENABLED` | `true` **solo cuando se active el worker** |

   La prueba usa SMTP en la API aunque el worker siga apagado. Gmail es destinatario; no requiere OAuth. Sin host, remitente o password cuando hay usuario, no se envía y se registra un aviso sin datos sensibles.
3. Desplegar el código/schema por el flujo habitual del repo. El hook existente aplica `prisma db push`; los modelos/campos son aditivos. El timer horario anterior queda retirado de la API.
4. Como dueño, abrir **Resumen periódico → Envío por mail** (también desde Configuración → Reporte automático), revisar el destinatario y usar **Enviar mail de prueba**. El asunto lleva «Prueba». Validar recepción en Gmail web/celular, claro y oscuro, y revisar spam. Las pruebas tienen un límite persistente de una por minuto por tienda y no guardan el borrador ni avanzan el período periódico.
5. Activar la configuración de la tienda, frecuencia, día y hora. Semana: lunes 00:00 a lunes siguiente 00:00 excluido. El día seleccionado indica cuándo se envía esa semana cerrada (lunes=1 a domingo=7). Quincena: ventanas 1–15 y 16–fin de mes; el día seleccionado aplica a ambas mitades y se limita a fin de mes en febrero. Mensual: mes calendario anterior, envío entre el día 1 y 28. Todo usa `Store.timezone`, sin depender de la zona del servidor.
6. **Activación manual pendiente:** configurar en un proceso programado existente o en el cron worker que Matias elija la ejecución UTC `*/5 * * * *`. No se creó ni modificó ningún servicio de Railway. Entrada preparada:

   ```sh
   # Desarrollo (tsx instalado)
   npm --prefix backend run reports:send
   # Imagen productiva, directorio backend, después del build habitual
   node dist/scripts/periodic-reports.js
   ```

   El comando procesa vencimientos y termina. `REPORT_MAIL_ENABLED` distinto de `true` lo deja apagado. El proceso requiere Node, Prisma generado y las variables habituales de configuración del backend. No requiere exponer otro puerto. Puede ejecutarse en infraestructura existente; Matias decide dónde habilitarlo. La precisión esperada es de hasta cinco minutos más el tiempo de ejecución. Si hubo inactividad, procesa el último período vencido; no genera un envío masivo de períodos históricos.

## Fiabilidad y límites

- `PeriodicReportDelivery` tiene índice único `(storeId, periodKey, recipient)`. Congela asunto, HTML y texto al primer intento. Los destinatarios se normalizan y cada uno tiene su entrega independiente. Destinatarios nuevos del mismo período reciben el mismo contenido congelado.
- Lock PostgreSQL global más transición atómica `PREPARED → SENDING → SENT`; se guarda cantidad de intentos y el identificador SMTP. `Message-ID` estable y header SMTP **`Resend-Idempotency-Key`**, cuya retención en Resend es de 24 horas. El registro propio no vence a las 24 horas.
- Se prioriza evitar duplicados: un timeout, error SMTP o caída después del claim deja `UNCERTAIN` o `SENDING`. **No se reenvía automáticamente.** Revisar primero el log de Resend con el destinatario y Message-ID; marcar `SENT` si se confirmó aceptación. Solo si se confirmó que no fue aceptado, devolver esa fila a `PREPARED` para otro intento. Un Message-ID por sí solo no garantiza deduplicación en SMTP genérico. Errores previos a preparar/reclamar la entrega sí se reintentan en la próxima ejecución.
- Ventas y devoluciones/conteos usan el mismo resumen de la app. Ganancia neta usa el servicio de Reportes y su cotización; se excluyen anulaciones y no se suma otra vez el valor tomado en canje. Sin cotización necesaria, el importe dice «Sin cotización». El stock disponible no se restringe a ingresos del período. Stock y deuda son valores al preparar el primer envío, no snapshots históricos.
- HTML con tablas, estilos inline, fallback Arial, ajuste a 390 px y estilos de modo oscuro. Capturas de Chromium claras/oscuras y transporte SMTP de captura validados; la inspección en un buzón Gmail real queda para la activación, sin simular que Chromium equivale a Gmail.
- Para detener: apagar el switch de la tienda, o retirar `REPORT_MAIL_ENABLED=true` del worker. No se borra el historial.

Referencias: [SMTP de Resend](https://resend.com/docs/send-with-smtp), [idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys), [CSS admitido por Gmail](https://developers.google.com/workspace/gmail/design/css).

## Evidencia local

`/workspace/qa-reporte-impl/`: `config-final-{1440,390}.png`, `mail-final-{390,700}.png`, `mail-dark-{390,700}.png`, HTML/texto extraídos de `mail-capturado.eml`, logs de lint/tests y `IMPL.md`. Datos ficticios exclusivamente en las bases locales `imanager_reporte_impl` y `imanager_reporte_test`, puertos 3680/4680. Capturas de la semana cerrada 12–18/10/2026; el 25/10 todavía no cerró la del 19–25. No se alteraron los archivos fuente del wireframe.
