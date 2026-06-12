-- CreateEnum
CREATE TYPE "HmoContractMarkupMode" AS ENUM ('GROSS_SHARE', 'MARKUP_FIXED', 'MARKUP_FROM_SHARES');

-- AlterTable
ALTER TABLE "hmo_contracts" ADD COLUMN     "markupFixedNgn" BIGINT,
ADD COLUMN     "markupMode" "HmoContractMarkupMode" NOT NULL DEFAULT 'GROSS_SHARE';
