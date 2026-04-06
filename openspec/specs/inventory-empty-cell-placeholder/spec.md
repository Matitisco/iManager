### Requirement: Placeholder visual para celdas vacías
Las celdas de la tabla de inventario cuyo valor sea `null`, `undefined` o string vacío (`""`) SHALL mostrar el texto `---` en color gris claro (`text-gray-300`) en lugar de quedar en blanco. El placeholder es solo visual y no se persiste en base de datos.

#### Scenario: Celda de texto vacía muestra placeholder
- **WHEN** una celda de tipo texto (imei, model) tiene valor `null`, `undefined` o `""`
- **THEN** la celda muestra `---` en `text-gray-300`; el área de hover y el hitbox de inline edit permanecen activos

#### Scenario: Celda de precio vacía muestra placeholder
- **WHEN** el campo `price` de un ítem es `null` o `undefined`
- **THEN** la celda muestra `---` en `text-gray-300` en lugar de `$0`

#### Scenario: Precio cero no es placeholder
- **WHEN** el campo `price` de un ítem es `0`
- **THEN** la celda muestra `$0` (precio válido, no placeholder)

#### Scenario: Celda de batería vacía muestra placeholder sin barra
- **WHEN** el campo `batteryHealth` de un ítem es `null`, `undefined` o `""`
- **THEN** la celda muestra `---` en `text-gray-300`; no se renderiza la barra de progreso

#### Scenario: Celda de status vacía muestra placeholder sin badge
- **WHEN** el campo `status` de un ítem es `null`, `undefined` o `""`
- **THEN** la celda muestra `---` en `text-gray-300` como texto plano, sin badge de color

### Requirement: Inline edit funciona sobre celdas con placeholder
Las celdas que muestran `---` SHALL activar el inline edit al hacer click, mostrando el input/select vacío (no el string `---`).

#### Scenario: Click en celda con placeholder activa input vacío
- **WHEN** el usuario hace click en una celda que muestra `---`
- **THEN** el input inline se activa con el campo vacío; el string `---` no aparece como valor inicial del input
