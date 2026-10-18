-- Additive: existing invitations retain NULL and use the store owner as fallback.
ALTER TABLE "StoreInvitation" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
