CREATE TABLE "ChatbotEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "intent" TEXT,
    "service" TEXT,
    "sourcePath" TEXT,
    "messagePreview" TEXT,
    "fallbackReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatbotEvent_eventType_idx" ON "ChatbotEvent"("eventType");
CREATE INDEX "ChatbotEvent_intent_idx" ON "ChatbotEvent"("intent");
CREATE INDEX "ChatbotEvent_service_idx" ON "ChatbotEvent"("service");
CREATE INDEX "ChatbotEvent_createdAt_idx" ON "ChatbotEvent"("createdAt");
CREATE INDEX "ChatbotEvent_eventType_createdAt_idx" ON "ChatbotEvent"("eventType", "createdAt");
