## Decisions
La batería fraccional sin porcentaje se convierte a porcentaje en la validación compartida de importación, independientemente del flag del plan. Los porcentajes explícitos y rangos conservan su escala. La calidad acepta pares A/B/C con modificadores + o - separados por barra; se normalizan espacios y mayúsculas, sin aceptar etiquetas arbitrarias. Reutilizar el parser de calidad para inferencia, validación y persistencia, conservando la condición Usado.

## Validation
Regresión sintética CSV con separador ; y 59 filas desde parser real hasta confirmación simulada. Tests por campo, correcciones y reimportación; TypeScript frontend/backend. Máximo dos workers, sin build ni suite completa.
