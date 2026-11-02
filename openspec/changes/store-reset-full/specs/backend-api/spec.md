## ADDED Requirements

### Requirement: Full store operational reset
POST /admin/store-reset SHALL aceptar scope full opcional; al omitirlo SHALL conservar el comportamiento previo. Full SHALL eliminar ventas, inventario, todos los clientes y sus saldos/notas/señas/cuenta corriente, todas las reparaciones y sus dependencias, canjes y devoluciones de la tienda.

#### Scenario: Saldo en otra moneda sin cotización
- **WHEN** se solicita full para una tienda ARS con cliente en USD y ventas sin cotización histórica
- **THEN** preview y apply completan sin separar ni convertir saldos

#### Scenario: Caja coherente
- **WHEN** se eliminan movimientos de las operaciones borradas
- **THEN** se incluyen reversiones y se descuenta el neto atribuible por caja, llevando a cero las cajas afectadas cuando no se puede atribuir el saldo sin ambigüedad

#### Scenario: Guardas y confirmación
- **WHEN** full tiene guards inválidos o apply no incluye expect idéntico al willDelete completo recalculado
- **THEN** devuelve error sin persistir cambios

#### Scenario: Rollback y preservación
- **WHEN** se ejecuta full en dryRun o falla una postcondición/auditoría
- **THEN** revierte todos los cambios
- **AND** apply exitoso conserva tienda, usuarios, miembros, configuración, catálogos/plantillas, billing, auditoría previa y todas las otras tiendas, registrando store.reset con scope full
