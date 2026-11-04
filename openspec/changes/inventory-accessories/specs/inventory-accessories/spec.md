## ADDED Requirements

### Requirement: Accesorios independientes por cantidad
El sistema SHALL distinguir DEVICE y ACCESSORY, con tipos fijos, compatibilidad opcional y cantidad entera no negativa; los accesorios SHALL carecer de IMEI, batería y condición.

#### Scenario: Alta y consulta
- **WHEN** se registra un accesorio
- **THEN** aparece en Accesorios y en la búsqueda de venta, y no en Equipos, Dashboard, Control de stock, catálogo ni reportes de equipos.

### Requirement: Venta segura y permisos existentes
El sistema SHALL reutilizar el descuento y la restitución transaccional e idempotente del stock y canSeeFinancials para los costos.

#### Scenario: Venta y anulación
- **WHEN** se venden unidades disponibles y luego se anula la venta
- **THEN** se descuentan y restituyen exactamente esas unidades; una sobreventa se rechaza sin efectos.

#### Scenario: Poco stock y costo
- **WHEN** un accesorio tiene menos de cinco unidades
- **THEN** muestra Poco stock; un usuario sin acceso financiero no ve ni envía costo.
