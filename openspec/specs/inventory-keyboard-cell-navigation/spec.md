### Requirement: Navegación Tab entre celdas de la misma fila
Mientras haya una celda en modo edición, el sistema SHALL soportar navegación horizontal con Tab y Shift+Tab entre las celdas editables de la fila.

#### Scenario: Tab avanza a la siguiente celda
- **WHEN** el usuario presiona Tab mientras edita una celda que no es la última columna visible
- **THEN** el valor actual se guarda via PATCH, el input actual se cierra, y la celda siguiente en la misma fila entra en modo edición

#### Scenario: Shift+Tab retrocede a la celda anterior
- **WHEN** el usuario presiona Shift+Tab mientras edita una celda que no es la primera columna visible
- **THEN** el valor actual se guarda via PATCH, el input actual se cierra, y la celda anterior en la misma fila entra en modo edición

#### Scenario: Tab al final de la fila
- **WHEN** el usuario presiona Tab mientras edita la última celda de la fila
- **THEN** el valor actual se guarda; la edición avanza a la primera celda editable de la fila siguiente (si existe)

#### Scenario: Shift+Tab en la primera celda
- **WHEN** el usuario presiona Shift+Tab mientras edita la primera celda de la fila
- **THEN** el valor actual se guarda; la edición retrocede a la última celda editable de la fila anterior (si existe)

### Requirement: Navegación vertical con Enter y flechas ↑↓
Mientras haya una celda en modo edición, el sistema SHALL soportar navegación vertical con Enter (confirmar y bajar) y con las teclas de flecha ↑↓.

#### Scenario: Enter baja a la misma columna
- **WHEN** el usuario presiona Enter mientras edita una celda
- **THEN** el valor actual se guarda via PATCH y la misma columna en la fila siguiente entra en modo edición

#### Scenario: Flecha ↓ baja sin editar
- **WHEN** el usuario presiona ↓ mientras edita una celda
- **THEN** el valor actual se guarda, el input se cierra, y el foco pasa a la misma celda de la fila siguiente sin activar el input de edición

#### Scenario: Flecha ↑ sube sin editar
- **WHEN** el usuario presiona ↑ mientras edita una celda
- **THEN** el valor actual se guarda, el input se cierra, y el foco pasa a la misma celda de la fila anterior sin activar el input de edición

#### Scenario: Enter en la última fila
- **WHEN** el usuario presiona Enter mientras edita una celda en la última fila visible
- **THEN** el valor actual se guarda y no hay movimiento de foco
