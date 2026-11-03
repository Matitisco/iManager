-- Quitar checks ANTES de restaurar los estados originales. No borra diario ni filas de negocio.
ALTER TABLE public."Sale" DROP CONSTRAINT IF EXISTS "contable_Sale_status_check";
ALTER TABLE public."TradeIn" DROP CONSTRAINT IF EXISTS "contable_TradeIn_status_check";
ALTER TABLE public."TradeIn" DROP CONSTRAINT IF EXISTS "contable_TradeIn_draftPaymentStatus_check";
ALTER TABLE public."ClientPayment" DROP CONSTRAINT IF EXISTS "contable_ClientPayment_kind_check";
ALTER TABLE public."SaleTender" DROP CONSTRAINT IF EXISTS "contable_SaleTender_role_check";
ALTER TABLE public."CommissionAccrual" DROP CONSTRAINT IF EXISTS "contable_CommissionAccrual_voidReason_check";
ALTER TABLE public."ClientDeposit" DROP CONSTRAINT IF EXISTS "contable_ClientDeposit_status_check";
ALTER TABLE public."ReturnCase" DROP CONSTRAINT IF EXISTS "contable_ReturnCase_status_check";
ALTER TABLE public."ReturnCase" DROP CONSTRAINT IF EXISTS "contable_ReturnCase_rmaStatus_check";
ALTER TABLE public."ReturnEvent" DROP CONSTRAINT IF EXISTS "contable_ReturnEvent_status_check";
ALTER TABLE public."CreditNote" DROP CONSTRAINT IF EXISTS "contable_CreditNote_status_check";
ALTER TABLE public."CashSession" DROP CONSTRAINT IF EXISTS "contable_CashSession_status_check";
ALTER TABLE public."CashMovement" DROP CONSTRAINT IF EXISTS "contable_CashMovement_kind_check";
