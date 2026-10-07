import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { agentNotifications, agents } from "@/db/schema";

/** GET /api/notifications?agentId=... — fetch notifications for an agent */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const limit = Math.min(Number(searchParams.get("limit") || "20"), 50);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId!));

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const conditions = [eq(agentNotifications.agentId, agentId)];
    if (unreadOnly) {
      conditions.push(eq(agentNotifications.isRead, "false"));
    }

    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(and(...conditions))
      .orderBy(desc(agentNotifications.createdAt))
      .limit(limit);

    const unreadCount = notifications.filter((n) => n.isRead === "false").length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** PATCH /api/notifications — mark notification(s) as read */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as { agentId: string; notificationId?: string; markAllRead?: boolean };
    const { agentId, notificationId, markAllRead } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    if (markAllRead) {
      await db
        .update(agentNotifications)
        .set({ isRead: "true" })
        .where(
          and(
            eq(agentNotifications.agentId, agentId),
            eq(agentNotifications.isRead, "false")
          )
        );
      return NextResponse.json({ message: "All notifications marked as read" });
    }

    if (notificationId) {
      await db
        .update(agentNotifications)
        .set({ isRead: "true" })
        .where(eq(agentNotifications.id, notificationId));
      return NextResponse.json({ message: "Notification marked as read" });
    }

    return NextResponse.json({ error: "Provide notificationId or markAllRead=true" }, { status: 400 });
  } catch (error) {
    console.error("Notifications PATCH error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** POST /api/notifications/poll — manually trigger inbox poll for an agent */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await req.json() as { agentId: string };
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    // Lazy import to avoid circular deps
    const { pollGmailInbox } = await import("@/app/api/chat/tools/gmailMonitor");
    const result = await pollGmailInbox(agentId);

    return NextResponse.json({
      message: `Inbox polled. Found ${result.newCount} new marketing email(s).`,
      ...result,
    });
  } catch (error) {
    console.error("Poll error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
