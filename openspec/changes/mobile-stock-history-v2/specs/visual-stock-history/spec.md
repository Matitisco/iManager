## ADDED Requirements

### Requirement: Referencias móviles v2
El sistema MUST aplicar el diseño aprobado hasta 760 px sin alterar la presentación de escritorio ni las operaciones existentes.

#### Scenario: Revisar un control
- **WHEN** se revisa un conteo en móvil
- **THEN** se muestran los tres pasos, cuatro grupos en una fila, cinco equipos expandibles y Registrar conteo sobre una franja blanca que no tapa contenido ni navegación.

#### Scenario: Iniciar un control
- **WHEN** se abre Iniciar control en móvil
- **THEN** solo aparecen encabezado, alcance disponible y acción Iniciar conteo, conservando errores y esqueletos.

#### Scenario: Historial móvil
- **WHEN** se consulta Historial en móvil
- **THEN** búsqueda y período comparten fila; Persona/Acción/Sección están ocultos; los eventos agrupados por día muestran acción, registro, primer nombre y hora.

### Requirement: Valor nuevo sin etiquetas de comparación
El sistema MUST omitir las etiquetas Antes y Después sobre los valores de las filas sin Antes real en todos los viewports, manteniendo ambas etiquetas cuando Antes existe.

#### Scenario: Campos mixtos
- **WHEN** un evento incluye campos con y sin Antes real
- **THEN** solo los campos con Antes real muestran las dos etiquetas de comparación; los demás muestran su valor nuevo sin etiqueta Después.

### Requirement: Detalle aprobado modal-v3
El sistema MUST presentar el detalle del evento mediante Sheet compartido y tokens del sistema: modal centrado de 480 px con alto máximo viewport menos 96 px en escritorio y bottom sheet con handle y máximo 85 % del viewport en móvil. Encabezado y acciones MUST permanecer fijos mientras el cuerpo hace scroll interno.

#### Scenario: Cambio de precio A
- **WHEN** el evento contiene un precio anterior real y uno nuevo
- **THEN** el detalle presenta autor, fecha, equipo/IMEI y comparación Antes/Después sin etiquetas o subtítulos adicionales.

#### Scenario: Alta C
- **WHEN** los campos del evento solo tienen un valor nuevo
- **THEN** cada campo muestra etiqueta y valor, sin Antes, Después ni guion de valor anterior.

#### Scenario: Cierre de control B con datos actuales
- **WHEN** un cierre de control incluye contadores matched, missing, surplus y sold
- **THEN** muestra Coinciden, Sin escanear, Sin cargar y Figuran vendidos, con Sin escanear en negro y solo los valores guardados; no inventa equipos, IMEI ni grupos ausentes cuando el evento carece de listas.

#### Scenario: Acciones por viewport
- **WHEN** se abre el detalle de un registro accesible
- **THEN** escritorio muestra Cerrar y la acción principal de 48 px; móvil muestra solo la acción principal negra de ancho completo, conservando el cierre del encabezado, permisos, errores y destinos de registros o la pestaña existente de Control de stock.
