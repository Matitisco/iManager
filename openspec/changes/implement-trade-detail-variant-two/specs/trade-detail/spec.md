## ADDED Requirements

### Requirement: Approved trade detail composition
El detalle de operaciones de Canje SHALL presentar la variante 2 aprobada con datos del registro real, sin flag de QA.

#### Scenario: Desktop detail
- **WHEN** se abre un canje en escritorio
- **THEN** muestra fecha y confirmación, Diferencia con el reloj al costado, estado técnico y tarjetas de recibido y entregado en dos columnas
- **AND** muestra precio y deuda calculados con las reglas existentes

#### Scenario: Mobile detail
- **WHEN** se abre el detalle a 390 px
- **THEN** las tarjetas están apiladas y el cuerpo tiene scroll interno con encabezado y acciones fijos

#### Scenario: History and existing actions
- **WHEN** se abre el historial o se cambia el estado técnico
- **THEN** conserva el submodal compartido y el guardado existente, sin eventos ni líneas adicionales en la hoja principal

#### Scenario: Pending or cancelled operation
- **WHEN** el canje está pendiente o anulado
- **THEN** conserva los datos y acciones aplicables a ese estado, sin inventar precio o deuda ni habilitar el selector para anulados
