-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "staffExternalId" TEXT NOT NULL,
    "staffEmail" TEXT,
    "partnerId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impersonation_sessions_staffExternalId_startedAt_idx" ON "impersonation_sessions"("staffExternalId", "startedAt");

-- CreateIndex
CREATE INDEX "impersonation_sessions_partnerId_startedAt_idx" ON "impersonation_sessions"("partnerId", "startedAt");

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
