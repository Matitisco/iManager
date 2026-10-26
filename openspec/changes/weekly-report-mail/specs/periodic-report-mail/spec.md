## ADDED Requirements
### Requirement: Reporte programado por tienda
El sistema SHALL enviar períodos cerrados en la zona de la tienda, con frecuencia semanal, quincenal o mensual, HTML y texto, y datos reales.
#### Scenario: Semana cerrada
- **WHEN** vence el día y hora configurado
- **THEN** informa lunes 00:00 a lunes siguiente 00:00 excluido, sin duplicar tienda+período+destinatario.
#### Scenario: Sin proveedor
- **WHEN** faltan variables de correo
- **THEN** no envía, registra un aviso y mantiene la API operativa.
### Requirement: Configuración y prueba del dueño
El sistema SHALL ofrecer la pestaña Envío por mail y restringir configuración y pruebas al dueño.
#### Scenario: Prueba
- **WHEN** un dueño solicita una prueba válida
- **THEN** recibe HTML/texto con asunto Prueba sin avanzar el envío periódico, sujeto a límite persistente.
#### Scenario: Empleado
- **WHEN** un empleado solicita configuración o prueba
- **THEN** recibe 403 sin enviar correo.
