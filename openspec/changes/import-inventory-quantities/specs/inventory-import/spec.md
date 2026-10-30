## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir cargar CSV o XLSX y mapear columnas para importar múltiples equipos desde Inventario y onboarding. SHALL reconocer Cantidad, cant, qty, quantity, unidades y stock como cantidad. SHALL conservar costo y precio unitarios y mostrar cantidad por fila y total de equipos antes de confirmar. SHALL permitir cientos y miles de equipos sin un máximo de 100, usando lotes de persistencia dentro de una transacción completa.

#### Scenario: Stock mayorista
- **WHEN** una fila sin IMEI tiene cantidad 58 y otra 83
- **THEN** la vista previa indica 141 equipos y se crean 141 registros individuales sin IMEI con los datos unitarios originales

#### Scenario: Cantidad por defecto
- **WHEN** no hay columna de cantidad o su celda está vacía
- **THEN** se prepara y guarda un equipo por fila

#### Scenario: Identificador en una fila múltiple
- **WHEN** una fila con cantidad mayor a uno incluye un IMEI
- **THEN** se crean las unidades sin IMEI y se conserva el identificador en notas para revisión

#### Scenario: Cantidad inválida o total
- **WHEN** una cantidad es inválida o corresponde a una fila detectada como total
- **THEN** se conserva un equipo En revisión y el valor original en notas, sin multiplicar el total

#### Scenario: Solo Modelo es requerido
- **WHEN** solo Modelo tiene valor
- **THEN** se crea un equipo con los campos opcionales vacíos o null
