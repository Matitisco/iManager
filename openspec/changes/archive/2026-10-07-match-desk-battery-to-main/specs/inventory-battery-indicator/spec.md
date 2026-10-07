## ADDED Requirements

### Requirement: Colores de batería equivalentes a main

El indicador de Inventario hi-fi MUST usar las mismas reglas de `main`: rojo por debajo de 70%, ámbar de 70% a 85% inclusive y verde por encima de 85%. La barra y el texto MUST reflejar ese color.

#### Scenario: Límites de color
- **WHEN** la batería es 69%, 70%, 85% o 86%
- **THEN** sus colores son rojo, ámbar, ámbar y verde respectivamente

### Requirement: Llenado animado equivalente a main

El indicador MUST animar el ancho de la barra desde cero hasta el porcentaje al aparecer, usando `motion/react`, y MUST actualizar el ancho cuando cambie el porcentaje.

#### Scenario: Aparición y cambio de valor
- **WHEN** el indicador aparece con 87% o recibe un nuevo porcentaje
- **THEN** la barra transiciona hasta el ancho correspondiente al valor

### Requirement: Formatos de batería de la referencia

El indicador MUST usar los helpers de formato de `main` y conservar los rangos. La tabla MUST seguir mostrando un guion cuando el equipo no tiene batería informada.

#### Scenario: Rango o fracción decimal
- **WHEN** el valor es `83-85%` o `0.84`
- **THEN** el texto muestra `83-85%` o `84%` y la barra representa 83% o 84% respectivamente

#### Scenario: Batería vacía
- **WHEN** el equipo no tiene batería informada
- **THEN** la celda muestra un guion sin inventar un porcentaje
