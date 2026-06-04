-- Track email verification on our side, independent of Clerk.
-- See lib/partnerSignup.ts for why: Clerk's admin-create flow defaults
-- to verified and refuses to walk it back for the primary email.

ALTER TABLE "partner_users"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
