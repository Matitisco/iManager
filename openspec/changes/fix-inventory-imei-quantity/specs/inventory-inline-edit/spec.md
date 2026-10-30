## ADDED Requirements

### Requirement: Cantidad inline según identidad del equipo
La celda Cantidad SHALL mostrar 1 sin input cuando hay IMEI, con tooltip «Equipo con IMEI: siempre 1 unidad». Sin IMEI SHALL admitir enteros >=1 sin máximo de UI y mostrar rechazos junto a la celda, asociados al control accesible.

#### Scenario: Equipo con IMEI
- **WHEN** se muestra un equipo identificado por IMEI
- **THEN** la celda contiene texto 1 con el tooltip y no permite edición

#### Scenario: Equipo sin IMEI
- **WHEN** se guarda una cantidad entera positiva sin IMEI
- **THEN** se actualiza por el flujo existente sin imponer un máximo de UI

#### Scenario: Rechazo de cantidad
- **WHEN** la cantidad es vacía, cero, negativa, fraccionaria o rechazada al persistir
- **THEN** aparece un error junto a esa celda y el valor guardado no cambia

#### Scenario: Cancelación
- **WHEN** se presiona Escape sobre la cantidad editada
- **THEN** se restaura el valor guardado y se limpia el error sin persistir
