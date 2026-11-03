## ADDED Requirements

### Requirement: Filtros de Ventas dentro del ancho mobile
La barra de Ventas SHALL mantener accesibles Ordenar, período, vendedor y estado sin desplazar horizontalmente la pantalla.

#### Scenario: Barra con los cuatro controles
- **WHEN** Ventas se muestra a 360 o 390 px
- **THEN** los controles permanecen dentro del ancho de la pantalla y pasan a otra línea cuando es necesario

### Requirement: E2e compatibles con encabezados ordenables
Los e2e SHALL identificar las columnas Venta y Vendedor por su nombre accesible actual y conservar sus aserciones de contenido y filtrado.

#### Scenario: Encabezados con botones de orden y filtro
- **WHEN** Ventas se muestra en escritorio
- **THEN** las pruebas encuentran los encabezados que contienen «Ordenar por venta» y «Ordenar por vendedor»
