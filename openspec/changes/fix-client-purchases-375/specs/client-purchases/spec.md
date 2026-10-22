## ADDED Requirements

### Requirement: Filtros legibles
Las opciones de filtros de columnas MUST mostrar una línea truncada y un contador separado dentro del viewport.

#### Scenario: Vendedor largo
- **WHEN** se abre Vendedor o cualquier filtro compartido a 390 o 1440 px
- **THEN** el nombre y contador no se superponen y el menú queda dentro de la pantalla

### Requirement: Historial de compras
Compras MUST mostrar IMEI completo, tres filas y acceso al historial completo en otra capa modal, con retorno en pantalla completa móvil.

#### Scenario: Cobertura y anulación
- **WHEN** hay ventas vigentes, por vencer en hasta 30 días calendario, vencidas o anuladas
- **THEN** aparecen sus fechas completas y colores aprobados; las anuladas conservan registro con importe tachado y quedan excluidas de todo total y contador

#### Scenario: Cliente sin compras
- **WHEN** no hay registros
- **THEN** aparece «Todavía no tiene compras» y los indicadores quedan en cero
