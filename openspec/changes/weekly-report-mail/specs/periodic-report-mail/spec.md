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
- **THEN** recibe HTML/texto con asunto Prueba sin avanzar el envío periódico, sujeto a límite persistente.
#### Scenario: Empleado
- **WHEN** un empleado solicita configuración o prueba
- **THEN** recibe 403 sin enviar correo.
