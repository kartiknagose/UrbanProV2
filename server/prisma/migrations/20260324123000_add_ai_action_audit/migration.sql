-- CreateTable
CREATE TABLE "AIActionAudit" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'CHAT',
    "intent" TEXT NOT NULL,
    "action" TEXT,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "requestText" TEXT,
    "requestData" JSONB,
    "responseText" TEXT,
    "responseData" JSONB,
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIActionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIActionAudit_userId_createdAt_idx" ON "AIActionAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIActionAudit_intent_createdAt_idx" ON "AIActionAudit"("intent", "createdAt");

-- CreateIndex
CREATE INDEX "AIActionAudit_status_createdAt_idx" ON "AIActionAudit"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AIActionAudit_createdAt_idx" ON "AIActionAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "AIActionAudit" ADD CONSTRAINT "AIActionAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
