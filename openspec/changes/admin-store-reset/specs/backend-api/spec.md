## ADDED Requirements

### Requirement: Test store business reset
El endpoint POST /admin/store-reset SHALL admitir exclusivamente platform admins y ambientes cuyo RAILWAY_ENVIRONMENT_NAME coincida con /test/i, validando storeId, email del OWNER activo y nombre exacto.

#### Scenario: Ambiente no permitido
- **WHEN** falta el ambiente o no coincide, incluso con dryRun
- **THEN** responde 403 antes de acceder a la base

#### Scenario: Preview y confirmación
- **WHEN** el admin solicita dryRun
- **THEN** devuelve conteos de borrado y conservación y token determinístico, y revierte la transacción

#### Scenario: Aplicación protegida
- **WHEN** confirm y expect coinciden con los conteos recalculados
- **THEN** elimina los datos de negocio de esa tienda, reinicia numeración y saldos de caja, conserva cuentas/configuración/auditoría previa y agrega store.reset en una transacción serializable

#### Scenario: Guarda o postcondición fallida
- **WHEN** falla identidad, confirmación, conteos, preservación o aislamiento de otra tienda
- **THEN** rechaza la operación sin persistir cambios

#### Scenario: Modelos futuros
- **WHEN** un modelo nuevo con storeId no tiene clasificación explícita
- **THEN** falla el test del DMMF
