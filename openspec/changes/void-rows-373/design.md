# Diseño

Generalizar el detector de bajas lógicas. Combinar las consultas activas y archivadas solamente para presentación; mantener los datos activos del contexto para operaciones y totales. Los filtros de estado activo excluyen bajas. Reutilizar ReasonSheet y transportar el motivo hasta la auditoría transaccional. Sin cambios de schema. Validar componentes móviles y desktop, suites unitarias, integración local y TypeScript.

La acción Anular revierte las operaciones integradas dentro de la transacción existente y guarda voidedAt, voidedBy y voidReason en venta y canje vinculados. Se conservan los endpoints cancel para compatibilidad; la interfaz usa void. CANCELADA/CANCELLED históricos se presentan y filtran como Anulada. Motivo opcional y permisos sensibles actuales.
