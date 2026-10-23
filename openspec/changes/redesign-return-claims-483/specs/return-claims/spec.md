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

### Requirement: Alta y fecha responsive
El sistema SHALL mostrar Fecha, Venta, resumen de IMEI/garantía/importe y Motivo en ese orden; SHALL crear el reclamo con diagnóstico null. SHALL reutilizar DatePicker con calendario flotante desktop e inline móvil sin la clase utilitaria `.inline`.

#### Scenario: Abrir calendario móvil
- **WHEN** se abre el calendario en Nuevo reclamo a 390 px
- **THEN** el calendario ocupa el ancho del campo dentro del scroll y no tapa el encabezado ni las acciones fijas

### Requirement: Historial en segunda capa
El sistema SHALL mostrar únicamente un reloj accesible de 44 px para abrir historial. Los eventos de `current.events` SHALL mostrarse completos en un segundo modal de 480 px en escritorio y pantalla completa móvil con Volver; el detalle principal SHALL contener únicamente el siguiente paso y su nota.

#### Scenario: Volver al borrador
- **WHEN** se abre y cierra el historial después de editar una nota sin guardar
- **THEN** se conserva la nota y el estado elegidos, sin persistir cambios y devolviendo el foco al reloj

#### Scenario: Acciones de reclamo anulado
- **WHEN** se muestra una fila anulada con movimientos financieros previos
- **THEN** el importe visible es «—», la píldora dice Anulado y no hay menú de acciones
