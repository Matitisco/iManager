## ADDED Requirements

### Requirement: Estado explícito y seguimiento compacto
El sistema SHALL mostrar estados seleccionables, nota opcional, fecha/estado/nota en cada evento y footer Cancelar/Guardar. SHALL persistir cambios únicamente al guardar y conservar el formulario ante errores.

#### Scenario: Guardar estado y nota
- **WHEN** se selecciona En diagnóstico y se agrega una nota
- **THEN** el backend guarda ambos de forma atómica y el timeline incluye la nota y fecha

#### Scenario: Cancelar un cambio RMA
- **WHEN** se selecciona un estado RMA y se cancela
- **THEN** no cambia el reclamo ni el equipo

### Requirement: Editar y anular desde la lista
El sistema SHALL ofrecer Editar y Anular desde click derecho, long-press y ⋯. Editar SHALL precargar los campos; Anular SHALL confirmar con «¿Anular reclamo?» y botón «Anular», y marcar ANULADO sin borrar registros, con auditoría y evento. Un anulado SHALL permanecer rojo, ser de solo lectura y no contribuir a contadores/totales de reclamos.

#### Scenario: Anular y recargar
- **WHEN** se confirma Anular y se recarga la lista
- **THEN** el registro continúa visible en rojo con estado Anulado y queda excluido de reportes y filtros activos

#### Scenario: Reclamo con movimientos registrados
- **WHEN** se solicita anular un reclamo ya resuelto
- **THEN** la confirmación aclara que conserva movimientos registrados, y la baja no altera caja ni stock históricos

#### Scenario: Permisos y tienda
- **WHEN** alguien sin permiso sensible intenta anular o modificar una resolución, o usa un ID de otra tienda
- **THEN** el backend rechaza la operación sin cambios
