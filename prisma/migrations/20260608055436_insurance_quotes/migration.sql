-- CreateEnum
CREATE TYPE "HmoQuoteStatus" AS ENUM ('CREATED', 'CONVERTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "HmoQuoteRequestSex" AS ENUM ('M', 'F', 'U');

-- CreateTable
CREATE TABLE "hmo_quote_requests" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "ageBucket" TEXT NOT NULL,
    "ageInYears" INTEGER NOT NULL,
    "sex" "HmoQuoteRequestSex" NOT NULL DEFAULT 'U',
    "dependents" INTEGER NOT NULL DEFAULT 0,
    "monthlyBudgetNgn" BIGINT,
    "state" TEXT,
    "lga" TEXT,
    "conditions" TEXT,
    "fintechRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hmo_quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_quotes" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" JSONB NOT NULL,
    "wholesaleNgn" BIGINT NOT NULL,
    "markupNgn" BIGINT NOT NULL,
    "memberPaysNgn" BIGINT NOT NULL,
    "splitsSnapshot" JSONB NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "status" "HmoQuoteStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hmo_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hmo_quote_requests_partnerId_createdAt_idx" ON "hmo_quote_requests"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "hmo_quote_requests_fintechRef_idx" ON "hmo_quote_requests"("fintechRef");

-- CreateIndex
CREATE INDEX "hmo_quotes_quoteRequestId_rank_idx" ON "hmo_quotes"("quoteRequestId", "rank");

-- CreateIndex
CREATE INDEX "hmo_quotes_partnerId_status_idx" ON "hmo_quotes"("partnerId", "status");

-- CreateIndex
CREATE INDEX "hmo_quotes_planId_idx" ON "hmo_quotes"("planId");

-- AddForeignKey
ALTER TABLE "hmo_quote_requests" ADD CONSTRAINT "hmo_quote_requests_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_quotes" ADD CONSTRAINT "hmo_quotes_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "hmo_quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_quotes" ADD CONSTRAINT "hmo_quotes_planId_fkey" FOREIGN KEY ("planId") REFERENCES "hmo_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_quotes" ADD CONSTRAINT "hmo_quotes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
