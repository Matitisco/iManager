## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL importar exactamente un equipo por fila con datos de las hojas seleccionadas, conservando valores incompatibles en notas o campos personalizados. Solo SHALL omitir filas vacías. La cantidad confirmada MUST coincidir con la vista previa.

#### Scenario: Valores inválidos y cantidades
- **WHEN** una fila contiene valores inválidos o una cantidad mayor a uno
- **THEN** se importa un equipo y se conserva el contenido original

#### Scenario: IMEI duplicado interno
- **WHEN** varias filas comparten IMEI
- **THEN** la primera conserva el IMEI y las demás se crean sin IMEI, en revisión y con nota «IMEI duplicado en el archivo: <imei>»

#### Scenario: IMEI existente
- **WHEN** la primera aparición del IMEI ya existe en la tienda
- **THEN** actualiza ese equipo y las demás filas crean equipos sin IMEI

#### Scenario: Fallo de persistencia
- **WHEN** no se puede importar todo el archivo
- **THEN** se revierten todas las escrituras y se informa un error claro
