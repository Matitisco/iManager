## ADDED Requirements

### Requirement: Test store business reset
El endpoint POST /admin/store-reset SHALL admitir exclusivamente platform admins y tiendas de pruebas incluidas explícitamente en STORE_RESET_ALLOWED_STORE_IDS, validando storeId, email del OWNER activo y nombre exacto. SHALL rechazar RAILWAY_ENVIRONMENT_NAME=production y NODE_ENV=production cuando no se define el ambiente de Railway.

#### Scenario: Ambiente no permitido
- **WHEN** Railway indica production, o no tiene nombre y NODE_ENV es production, incluso con dryRun
- **THEN** responde 403 antes de acceder a la base

#### Scenario: Allowlist obligatoria
- **WHEN** STORE_RESET_ALLOWED_STORE_IDS está ausente, vacía o no incluye el storeId exacto
- **THEN** responde 403 antes de acceder a la base, también en dryRun

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
