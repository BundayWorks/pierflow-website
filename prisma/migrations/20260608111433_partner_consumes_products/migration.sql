-- CreateEnum
CREATE TYPE "PartnerProduct" AS ENUM ('RECORDS', 'INSURANCE');

-- AlterEnum
ALTER TYPE "PartnerType" ADD VALUE 'FINTECH';

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "consumesProducts" "PartnerProduct"[] DEFAULT ARRAY['RECORDS']::"PartnerProduct"[];
