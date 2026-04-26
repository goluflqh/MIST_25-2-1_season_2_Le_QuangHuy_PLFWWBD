import { prisma, isPrismaDatabaseUnavailable, logPrismaAvailabilityWarning } from "@/lib/prisma";

export type ChatbotEventType = "ai_answered" | "lead_signal" | "unmatched" | "fallback";

interface RecordChatbotEventInput {
  eventType: ChatbotEventType;
  fallbackReason?: string | null;
  intent?: string | null;
  messagePreview?: string | null;
  service?: string | null;
  sourcePath?: string | null;
}

export interface ChatbotDashboardMetrics {
  aiAnsweredCount: number;
  fallbackCount: number;
  leadSignalCount: number;
  recentUnmatched: Array<{
    createdAt: string;
    eventType: string;
    fallbackReason: string | null;
    intent: string | null;
    messagePreview: string | null;
    service: string | null;
  }>;
  totalChatsMeasured: number;
  unmatchedCount: number;
}

const DASHBOARD_WINDOW_DAYS = 7;
const CHATBOT_RESPONSE_EVENT_TYPES = ["ai_answered", "unmatched", "fallback"] as const;
const TRAINING_GAP_REASON = "training_gap";

function buildDashboardFallback(): ChatbotDashboardMetrics {
  return {
    aiAnsweredCount: 0,
    fallbackCount: 0,
    leadSignalCount: 0,
    recentUnmatched: [],
    totalChatsMeasured: 0,
    unmatchedCount: 0,
  };
}

export async function recordChatbotEvent({
  eventType,
  fallbackReason,
  intent,
  messagePreview,
  service,
  sourcePath,
}: RecordChatbotEventInput) {
  try {
    await prisma.chatbotEvent.create({
      data: {
        eventType,
        fallbackReason: fallbackReason || null,
        intent: intent || null,
        messagePreview: messagePreview?.slice(0, 160) || null,
        service: service || null,
        sourcePath: sourcePath?.slice(0, 255) || null,
      },
    });
  } catch (error) {
    if (isPrismaDatabaseUnavailable(error)) {
      logPrismaAvailabilityWarning("Chatbot event metrics fallback", error);
      return;
    }

    console.error("[chatbot-metrics] Failed to persist chatbot event:", error);
  }
}

export async function getChatbotDashboardMetrics(): Promise<ChatbotDashboardMetrics> {
  const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  try {
    const [
      totalChatsMeasured,
      aiAnsweredCount,
      leadSignalCount,
      fallbackCount,
      unmatchedCount,
      recentUnmatched,
    ] = await Promise.all([
        prisma.chatbotEvent.count({
          where: {
            createdAt: { gte: since },
            eventType: { in: [...CHATBOT_RESPONSE_EVENT_TYPES] },
          },
        }),
        prisma.chatbotEvent.count({
          where: {
            createdAt: { gte: since },
            eventType: "ai_answered",
          },
        }),
        prisma.chatbotEvent.count({
          where: {
            createdAt: { gte: since },
            eventType: "lead_signal",
          },
        }),
        prisma.chatbotEvent.count({
          where: {
            createdAt: { gte: since },
            eventType: "fallback",
          },
        }),
        prisma.chatbotEvent.count({
          where: {
            createdAt: { gte: since },
            eventType: "unmatched",
            fallbackReason: TRAINING_GAP_REASON,
          },
        }),
        prisma.chatbotEvent.findMany({
          where: {
            createdAt: { gte: since },
            OR: [
              { eventType: "fallback" },
              { eventType: "unmatched", fallbackReason: TRAINING_GAP_REASON },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            createdAt: true,
            eventType: true,
            fallbackReason: true,
            intent: true,
            messagePreview: true,
            service: true,
          },
        }),
      ]);

    return {
      aiAnsweredCount,
      fallbackCount,
      leadSignalCount,
      recentUnmatched: recentUnmatched.map((item) => ({
        createdAt: item.createdAt.toISOString(),
        eventType: item.eventType,
        fallbackReason: item.fallbackReason,
        intent: item.intent,
        messagePreview: item.messagePreview,
        service: item.service,
      })),
      totalChatsMeasured,
      unmatchedCount,
    };
  } catch (error) {
    if (isPrismaDatabaseUnavailable(error)) {
      logPrismaAvailabilityWarning("Dashboard chatbot metrics fallback", error);
      return buildDashboardFallback();
    }

    console.error("[chatbot-metrics] Failed to load dashboard metrics:", error);
    return buildDashboardFallback();
  }
}
