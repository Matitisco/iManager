## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir cargar CSV/XLSX y proponer el mapeo mediante Decisions gpt-6-luna como fuente primaria. SHALL validar contra todas las filas (formatos, contenido, duplicados y aceptación >=85%), corregir hasta dos veces con errores concretos y conservar el mejor plan con columnas por revisar si persisten dudas. SHALL usar heurísticas solo como pista y respaldo ante fallo/timeout, finalizar en menos de 20 segundos y explicar filas descartadas.

#### Scenario: Corrección automática
- **WHEN** el modelo propone columnas incoherentes
- **THEN** la app reconsulta con el plan y errores verificados sin descartar filas en silencio

#### Scenario: Calidad como condición
- **WHEN** condition contiene calidad cosmética u otros valores inválidos
- **THEN** el mapeo automático preserva la columna como grade válido o campo personalizado

#### Scenario: Tiempo agotado
- **WHEN** se agota el presupuesto compartido
- **THEN** la app devuelve el mejor plan disponible y las dudas visibles
