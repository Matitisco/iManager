## ADDED Requirements
### Requirement: Reporte programado por tienda
El sistema SHALL enviar períodos cerrados en la zona de la tienda, con frecuencia semanal, quincenal o mensual, HTML y texto, y datos reales.
#### Scenario: Semana cerrada
- **WHEN** vence el día y hora configurado
- **THEN** informa lunes 00:00 a lunes siguiente 00:00 excluido, sin duplicar tienda+período+destinatario.
#### Scenario: Sin proveedor
- **WHEN** faltan variables de correo
- **THEN** no envía, registra un aviso y mantiene la API operativa.
#### Scenario: Timer de la API
- **WHEN** la API arranca con REPORT_MAIL_ENABLED=true
- **THEN** ejecuta el despachador con lock PostgreSQL cada cinco minutos, sin duplicar entregas entre réplicas ni superponer corridas locales; al cerrar cancela el timer y espera la corrida activa.
#### Scenario: Desactivado
- **WHEN** REPORT_MAIL_ENABLED no es exactamente true
- **THEN** la API no programa el timer ni consulta reportes automáticamente.
### Requirement: Equipos por revisar
El mail SHALL incluir en HTML y texto la cantidad actual de equipos sin archivar con status EN_REVISION de la tienda y un enlace al filtro correspondiente del inventario.
#### Scenario: Marcas de importación
- **WHEN** hay equipos con IMEI duplicado, posible total o valores por revisar marcados EN_REVISION
- **THEN** se cuentan una vez por equipo, excluyendo archivados y otras tiendas; el enlace abre solo En revisión y la sección también aparece con cero equipos.
### Requirement: Configuración y prueba del dueño
El sistema SHALL ofrecer la pestaña Envío por mail y restringir configuración y pruebas al dueño.
#### Scenario: Prueba
- **WHEN** un dueño solicita una prueba válida
- **THEN** recibe HTML/texto con asunto Prueba sin guardar frecuencia, horario, activación ni destinatarios del borrador y sin avanzar el envío periódico, sujeto a límite persistente.
#### Scenario: Recuperación de carga
- **WHEN** falla o vence la carga de configuración al reabrir la pantalla
- **THEN** muestra el error y permite reintentar; al cargar correctamente habilita el formulario. Las respuestas de una pantalla cerrada no actualizan la nueva instancia.
#### Scenario: Empleado
- **WHEN** un empleado solicita configuración o prueba
- **THEN** recibe 403 sin enviar correo.
### Requirement: Transporte Resend HTTP
El sistema SHALL priorizar la API HTTP de Resend cuando exista RESEND_API_KEY, usando SMTP_FROM o MAIL_FROM como remitente, Bearer e Idempotency-Key, y guardar el id devuelto como providerId en entregas periódicas.
#### Scenario: Resend configurado
- **WHEN** se solicita un envío con clave y remitente configurados
- **THEN** envía por POST HTTPS con un timeout de 15 segundos sin abrir conexiones SMTP.
#### Scenario: Error del proveedor
- **WHEN** Resend rechaza, falla, vence el timeout o no devuelve un id válido durante una prueba
- **THEN** responde 502 con el error de dominio «No se pudo enviar el mail de prueba.» sin guardar el borrador.
#### Scenario: Compatibilidad SMTP
- **WHEN** no existe RESEND_API_KEY
- **THEN** conserva el transporte nodemailer SMTP existente.
