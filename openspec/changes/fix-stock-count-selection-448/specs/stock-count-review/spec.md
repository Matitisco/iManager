## ADDED Requirements

### Requirement: Selección explícita de diferencias
El sistema SHALL abrir/reabrir/cambiar de control sin selección y vaciarla al cambiar de grupo. Solo miembros con permiso de gestionar el conteo SHALL seleccionar y resolver.

#### Scenario: Consultar y cambiar de grupo
- **WHEN** se abre un resultado o se cambia de grupo
- **THEN** ninguna fila está seleccionada y la acción de ajuste está deshabilitada.

### Requirement: Confirmación del ajuste visible
El sistema SHALL indicar cantidad y consecuencia y confirmar solo los equipos seleccionados del grupo visible, mostrando IMEI y motivo Faltante para archivo. SHALL conservar la resolución, permisos e historial actuales.

#### Scenario: Cancelar o fallar
- **WHEN** se cancela la confirmación o falla su persistencia
- **THEN** cancelar no envía cambios y el fallo conserva la confirmación con error visible y selección para reintentar.

#### Scenario: Confirmar selección
- **WHEN** se confirma un grupo con selección
- **THEN** solo esa selección se envía y el envío bloquea cierre y repetición.

### Requirement: Limitaciones y excluidos explícitos
El sistema SHALL distinguir cero escaneos, esperados sin escanear y comparación sin faltantes sin afirmar completitud física ni pérdidas. SHALL mostrar la cantidad excluida sin IMEI por separado sin reclasificarla.

#### Scenario: Cierre sin escaneos
- **WHEN** scanCount es cero
- **THEN** se informa Sin escaneos junto al resultado y se aclara que los faltantes no confirman pérdidas.

#### Scenario: Comparación con escaneos
- **WHEN** scanCount es mayor que cero
- **THEN** se informa cantidad de IMEI distintos y presencia/ausencia de esperados sin escanear, conservando todos los grupos originales.
