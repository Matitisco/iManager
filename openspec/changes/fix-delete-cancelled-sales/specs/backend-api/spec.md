## ADDED Requirements

### Requirement: Eliminar ventas canceladas sin repetir efectos
El sistema SHALL permitir a miembros autorizados eliminar ventas canceladas de su tienda, conservando inventario, canje, cliente y pagos y registrando la eliminación en auditoría.

#### Scenario: Cancelar y eliminar una venta con canje
- **WHEN** se cancela una operación y después se elimina su venta
- **THEN** la venta desaparece, el canje cancelado y los pagos se conservan y el stock y saldo no vuelven a modificarse

#### Scenario: Eliminar desde las interfaces de Ventas
- **WHEN** se confirma Eliminar desde desktop, la hoja móvil o una selección de ventas canceladas
- **THEN** los registros eliminados desaparecen y siguen ausentes al recargar

#### Scenario: Venta activa
- **WHEN** se usa Eliminar sobre una venta integrada activa
- **THEN** se conserva la cancelación de la operación y su historial

#### Scenario: Usuario sin permiso o venta de otra tienda
- **WHEN** se intenta eliminar sin permiso sensible o fuera de la tienda
- **THEN** se rechaza la solicitud sin modificar los datos
