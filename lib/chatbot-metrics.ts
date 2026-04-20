import { prisma, isPrismaDatabaseUnavailable, logPrismaAvailabilityWarning } from "@/lib/prisma";

export type ChatbotEventType = "lead_signal" | "unmatched" | "fallback";

interface RecordChatbotEventInput {
  eventType: ChatbotEventType;
  fallbackReason?: string | null;
  intent?: string | null;
  messagePreview?: string | null;
  service?: string | null;
  sourcePath?: string | null;
}

export interface ChatbotDashboardMetrics {
  fallbackCount: number;
  leadSignalCount: number;
  recentUnmatched: Array<{
    createdAt: string;
    intent: string | null;
    messagePreview: string | null;
    service: string | null;
  }>;
  totalChatsMeasured: number;
  unmatchedCount: number;
}

const DASHBOARD_WINDOW_DAYS = 7;

function buildDashboardFallback(): ChatbotDashboardMetrics {
  return {
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
    const [totalChatsMeasured, leadSignalCount, fallbackCount, unmatchedCount, recentUnmatched] =
      await Promise.all([
        prisma.chatbotEvent.count({
          where: {
            createdAt: { gte: since },
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
          },
        }),
        prisma.chatbotEvent.findMany({
          where: {
            createdAt: { gte: since },
            eventType: "unmatched",
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            createdAt: true,
            intent: true,
            messagePreview: true,
            service: true,
          },
        }),
      ]);

    return {
      fallbackCount,
      leadSignalCount,
      recentUnmatched: recentUnmatched.map((item) => ({
        createdAt: item.createdAt.toISOString(),
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
