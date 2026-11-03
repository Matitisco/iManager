# Diseño

StoreReseller independiente de StoreMember. Sale admite cero o un vendedor; comisiones usan memberId/resellerId excluyentes, reglas globales con ambos nulos. Identificador de selección reseller:<id>, nunca una membresía ficticia.

Migración 20261103210300_store_resellers: adiciones nullable, CHECKs y DROP NOT NULL autorizado en memberId de pagos/devengamientos. Sin cambios de datos anteriores. Directorio por tienda con unicidad case-insensitive y archivo lógico; Ventas permite crear/renombrar/archivar; Comisiones conserva asignación masiva y liquidación. Archivados siguen liquidándose.

Verificación: lint, unitarios y componentes relacionados (2 workers); integraciones y E2E solo CI.

El reset administrativo conserva el directorio StoreReseller, igual que las reglas y pagos; la clasificación explícita del nuevo modelo mantiene operativo ese circuito.
