# Reporte por mail: activación y operación

Issue #374. Mail variante 1 y configuración variante 2. No se configuró un proveedor, no se crearon servicios y no se enviaron correos reales durante la implementación.

## Pasos para Matias

1. En Resend, agregar y verificar un dominio propio (por ejemplo un subdominio de correo). Publicar los registros SPF y DKIM que indica Resend, y DMARC según la política del dominio. Crear una API key limitada al envío para ese dominio. No guardar claves en el repo.
2. Configurar en la API (el timer integrado es el camino recomendado):

   | Variable | Valor |
   |---|---|
   | `SMTP_HOST` | `smtp.resend.com` |
   | `SMTP_PORT` | `587` (STARTTLS), o `465` (TLS implícito) |
   | `SMTP_USER` | `resend` |
   | `SMTP_PASS` | API key de Resend |
   | `SMTP_FROM` | `iManager <reportes@dominio-verificado>` |
   | `REPORT_APP_URL` | URL pública HTTPS de la app, sin hash; fallback `FRONTEND_URL` |
   | `DATABASE_URL` | Base PostgreSQL de la aplicación; misma base en todas las réplicas |
   | `REPORT_MAIL_ENABLED` | `true` para habilitar el timer en la API; cualquier otro valor lo deja apagado |
   | `NODE_ENV` | `production` (también es el valor por defecto si falta) |
   | `FIREBASE_PROJECT_ID` | Proyecto de Firebase de la aplicación |
   | `FIREBASE_CLIENT_EMAIL` | Email de la cuenta de servicio de Firebase Admin |
   | `FIREBASE_PRIVATE_KEY` | Clave privada de esa cuenta; admite saltos escapados como `\n` |
   | `FIRESTORE_DATABASE_ID` | ID de la base Firestore configurada para la aplicación |

   Las cuatro variables de Firebase/Firestore y `DATABASE_URL` son obligatorias según `backend/src/config/env.ts`, incluso para el CLI en producción: la validación ocurre antes de consultar `REPORT_MAIL_ENABLED`. La única excepción de Firebase es `NODE_ENV=test` junto con `ENABLE_TEST_AUTH_BYPASS=true`; no usarla en producción. `PORT` es opcional (default 3000); conservar `CORS_ALLOWED_ORIGINS` para el acceso habitual de la app.

   La prueba usa SMTP en la API aunque el timer siga apagado. Gmail es destinatario; no requiere OAuth. Sin host, remitente o password cuando hay usuario, no se envía y se registra un aviso sin datos sensibles.
3. Desplegar el código/schema por el flujo habitual del repo. El hook existente aplica `prisma db push`; los modelos/campos son aditivos. La API registra el timer al quedar lista y lo cancela al cerrar; espera los envíos en curso antes de desconectar PostgreSQL. SIGINT y SIGTERM usan ese cierre. No se modifica infraestructura ni variables de Railway como parte de este cambio.
4. Como dueño, abrir **Resumen periódico → Envío por mail** (también desde Configuración → Reporte automático), revisar el destinatario y usar **Enviar mail de prueba**. El asunto lleva «Prueba». Validar recepción en Gmail web/celular, claro y oscuro, y revisar spam. Las pruebas tienen un límite persistente de una por minuto por tienda y no guardan el borrador ni avanzan el período periódico.
5. Activar la configuración de la tienda, frecuencia, día y hora. Semana: lunes 00:00 a lunes siguiente 00:00 excluido. El día seleccionado indica cuándo se envía esa semana cerrada (lunes=1 a domingo=7). Quincena: ventanas 1–15 y 16–fin de mes; el día seleccionado aplica a ambas mitades y se limita a fin de mes en febrero. Mensual: mes calendario anterior, envío entre el día 1 y 28. Todo usa `Store.timezone`, sin depender de la zona del servidor.
6. **Camino recomendado: timer dentro de la API.** Al arrancar con `REPORT_MAIL_ENABLED=true`, la API revisa vencimientos cada cinco minutos; la primera revisión ocurre cinco minutos después de quedar lista. No hace falta otro servicio ni cron. Cada réplica usa `runDueReportsLocked`, la misma lógica del CLI, con el lock global PostgreSQL existente. No superpone corridas dentro de una réplica; si una corrida sigue activa, saltea ese tick. Reiniciar la API para aplicar un cambio de variables. La precisión normal es de hasta cinco minutos más el tiempo de ejecución (puede demorarse más si la corrida anterior sigue activa). Si hubo inactividad, procesa el último período vencido; no genera un envío masivo de períodos históricos.

   El CLI queda disponible para una ejecución puntual o como alternativa si se decide usar infraestructura programada externa:

   ```sh
   # Desarrollo (tsx instalado)
   npm --prefix backend run reports:send
   # Imagen productiva, directorio backend, después del build habitual
   node dist/scripts/periodic-reports.js
   ```

   El comando procesa vencimientos y termina; requiere las mismas variables del cuadro, Node y Prisma generado. No requiere exponer otro puerto. Si se elige un cron externo, usar `*/5 * * * *` UTC y evitar mantener dos planificadores por simplicidad operativa; el lock y las entregas persistentes protegen igualmente frente a ejecuciones simultáneas. No se creó ni modificó ningún servicio de Railway.

## Fiabilidad y límites

- `PeriodicReportDelivery` tiene índice único `(storeId, periodKey, recipient)`. Congela asunto, HTML y texto al primer intento. Los destinatarios se normalizan y cada uno tiene su entrega independiente. Destinatarios nuevos del mismo período reciben el mismo contenido congelado.
- Lock PostgreSQL global más transición atómica `PREPARED → SENDING → SENT`; se guarda cantidad de intentos y el identificador SMTP. `Message-ID` estable y header SMTP **`Resend-Idempotency-Key`**, cuya retención en Resend es de 24 horas. El registro propio no vence a las 24 horas.
- Se prioriza evitar duplicados: un timeout, error SMTP o caída después del claim deja `UNCERTAIN` o `SENDING`. **No se reenvía automáticamente.** Revisar primero el log de Resend con el destinatario y Message-ID; marcar `SENT` si se confirmó aceptación. Solo si se confirmó que no fue aceptado, devolver esa fila a `PREPARED` para otro intento. Un Message-ID por sí solo no garantiza deduplicación en SMTP genérico. Errores previos a preparar/reclamar la entrega sí se reintentan en la próxima ejecución.
- Ventas y devoluciones/conteos usan el mismo resumen de la app. Ganancia neta usa el servicio de Reportes y su cotización; se excluyen anulaciones y no se suma otra vez el valor tomado en canje. Sin cotización necesaria, el importe dice «Sin cotización». El stock disponible no se restringe a ingresos del período. Stock, equipos por revisar y deuda son valores al preparar el primer envío, no snapshots históricos.
- **Equipos por revisar:** cuenta `InventoryItem` de la tienda con `archivedAt=null` y `status=EN_REVISION`, sin filtrar por fecha de ingreso. El importador guarda motivos en `batteryNote` (IMEI duplicado, «Parece una fila de total», valores incompatibles). Se cuenta cada equipo una vez, aunque tenga varios motivos. HTML y texto incluyen la sección, incluso en cero, y el enlace `/#/stock/equipos?status=EN_REVISION`, que limpia filtros previos y abre «En revisión». Las entregas ya preparadas conservan su contenido congelado.
- HTML con tablas, estilos inline, fallback Arial, ajuste a 390 px y estilos de modo oscuro. Capturas de Chromium claras/oscuras y transporte SMTP de captura validados; la inspección en un buzón Gmail real queda para la activación, sin simular que Chromium equivale a Gmail.
- Para detener: apagar el switch de la tienda, o cambiar `REPORT_MAIL_ENABLED` a `false` en la API y reiniciarla (también en cualquier cron externo que se haya configurado). El cierre espera la corrida en curso; el switch no cancela mensajes ya reclamados. No se borra el historial.

Referencias: [SMTP de Resend](https://resend.com/docs/send-with-smtp), [idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys), [CSS admitido por Gmail](https://developers.google.com/workspace/gmail/design/css).

## Evidencia local

`/workspace/qa-reporte-impl/`: `config-final-{1440,390}.png`, `mail-final-{390,700}.png`, `mail-dark-{390,700}.png`, HTML/texto extraídos de `mail-capturado.eml`, logs de lint/tests y `IMPL.md`. Datos ficticios exclusivamente en las bases locales `imanager_reporte_impl` y `imanager_reporte_test`, puertos 3680/4680. Capturas de la semana cerrada 12–18/10/2026; el 25/10 todavía no cerró la del 19–25. No se alteraron los archivos fuente del wireframe.

## Validación de la continuación #374

Tests relacionados con SMTP falso en loopback y PostgreSQL efímero local: timer activado/desactivado, frecuencia, no solapamiento, cierre con corrida activa, lock entre réplicas, idempotencia persistente, métricas por tienda y archivado, sección HTML/texto y filtro de inventario desde el enlace. Sin correo real ni acceso a producción.
