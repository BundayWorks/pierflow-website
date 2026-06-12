-- AlterTable
ALTER TABLE "hmo_claims" ADD COLUMN     "medplumClaimId" TEXT;

-- AlterTable
ALTER TABLE "hmo_enrollments" ADD COLUMN     "medplumCoverageId" TEXT,
ADD COLUMN     "medplumPatientId" TEXT;
