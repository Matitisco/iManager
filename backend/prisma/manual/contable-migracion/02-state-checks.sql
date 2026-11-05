-- Aplicar DESPUES del backfill. Instalar no valida filas historicas.
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_Sale_status_check' AND conrelid = 'public."Sale"'::regclass) THEN
  ALTER TABLE public."Sale" ADD CONSTRAINT "contable_Sale_status_check" CHECK ("status" IS NULL OR "status" = public.contable_normalize_state('sale', "status")) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_TradeIn_status_check' AND conrelid = 'public."TradeIn"'::regclass) THEN
  ALTER TABLE public."TradeIn" ADD CONSTRAINT "contable_TradeIn_status_check" CHECK ("status" IS NULL OR "status" = public.contable_normalize_state('trade', "status")) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_TradeIn_draftPaymentStatus_check' AND conrelid = 'public."TradeIn"'::regclass) THEN
  ALTER TABLE public."TradeIn" ADD CONSTRAINT "contable_TradeIn_draftPaymentStatus_check" CHECK ("draftPaymentStatus" IS NULL OR "draftPaymentStatus" = public.contable_normalize_state('sale', "draftPaymentStatus")) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_ClientPayment_kind_check' AND conrelid = 'public."ClientPayment"'::regclass) THEN
  ALTER TABLE public."ClientPayment" ADD CONSTRAINT "contable_ClientPayment_kind_check" CHECK ("kind" IS NULL OR "kind" IN ('PAGO', 'DEVOLUCION', 'VUELTO', 'CARGO', 'NOTA_CREDITO', 'SENA', 'CREDITO', 'APLICACION')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_SaleTender_role_check' AND conrelid = 'public."SaleTender"'::regclass) THEN
  ALTER TABLE public."SaleTender" ADD CONSTRAINT "contable_SaleTender_role_check" CHECK ("role" IS NULL OR "role" IN ('COBRO', 'VUELTO')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_CommissionAccrual_voidReason_check' AND conrelid = 'public."CommissionAccrual"'::regclass) THEN
  ALTER TABLE public."CommissionAccrual" ADD CONSTRAINT "contable_CommissionAccrual_voidReason_check" CHECK ("voidReason" IS NULL OR "voidReason" IN ('CANCELLED', 'DELETED', 'EDITED')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_ClientDeposit_status_check' AND conrelid = 'public."ClientDeposit"'::regclass) THEN
  ALTER TABLE public."ClientDeposit" ADD CONSTRAINT "contable_ClientDeposit_status_check" CHECK ("status" IS NULL OR "status" IN ('ACTIVE', 'CREDIT', 'APPLIED', 'REFUNDED', 'REVERSED')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_ReturnCase_status_check' AND conrelid = 'public."ReturnCase"'::regclass) THEN
  ALTER TABLE public."ReturnCase" ADD CONSTRAINT "contable_ReturnCase_status_check" CHECK ("status" IS NULL OR "status" IN ('ABIERTO', 'EN_DIAGNOSTICO', 'EN_PROVEEDOR', 'RESUELTO', 'ANULADO')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_ReturnCase_rmaStatus_check' AND conrelid = 'public."ReturnCase"'::regclass) THEN
  ALTER TABLE public."ReturnCase" ADD CONSTRAINT "contable_ReturnCase_rmaStatus_check" CHECK ("rmaStatus" IS NULL OR "rmaStatus" IN ('ENVIADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'RECIBIDO')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_ReturnEvent_status_check' AND conrelid = 'public."ReturnEvent"'::regclass) THEN
  ALTER TABLE public."ReturnEvent" ADD CONSTRAINT "contable_ReturnEvent_status_check" CHECK ("status" IS NULL OR "status" IN ('ABIERTO', 'EN_DIAGNOSTICO', 'EN_PROVEEDOR', 'RESUELTO', 'ANULADO', 'ENVIADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'RECIBIDO')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_CreditNote_status_check' AND conrelid = 'public."CreditNote"'::regclass) THEN
  ALTER TABLE public."CreditNote" ADD CONSTRAINT "contable_CreditNote_status_check" CHECK ("status" IS NULL OR "status" IN ('ABIERTA', 'APLICADA')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_CashSession_status_check' AND conrelid = 'public."CashSession"'::regclass) THEN
  ALTER TABLE public."CashSession" ADD CONSTRAINT "contable_CashSession_status_check" CHECK ("status" IS NULL OR "status" IN ('OPEN', 'SUBMITTED', 'APPROVED', 'RECOUNT')) NOT VALID;
END IF; END $check$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contable_CashMovement_kind_check' AND conrelid = 'public."CashMovement"'::regclass) THEN
  ALTER TABLE public."CashMovement" ADD CONSTRAINT "contable_CashMovement_kind_check" CHECK ("kind" IS NULL OR "kind" IN ('FONDO', 'INGRESO', 'EGRESO', 'AJUSTE', 'TRANSFERENCIA', 'COBRO', 'DEVOLUCION', 'ANULACION', 'ARQUEO')) NOT VALID;
END IF; END $check$;
COMMIT;
