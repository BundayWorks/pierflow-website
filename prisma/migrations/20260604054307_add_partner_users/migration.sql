-- CreateEnum
CREATE TYPE "PartnerUserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "partner_users" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "externalId" TEXT,
    "email" TEXT NOT NULL,
    "role" "PartnerUserRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "partner_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_users_externalId_key" ON "partner_users"("externalId");

-- CreateIndex
CREATE INDEX "partner_users_partnerId_idx" ON "partner_users"("partnerId");

-- CreateIndex
CREATE INDEX "partner_users_email_idx" ON "partner_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "partner_users_partnerId_email_key" ON "partner_users"("partnerId", "email");

-- AddForeignKey
ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
