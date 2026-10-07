import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { agents, agentChats, agentConnectors } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { ensureDatabaseTables } from "@/db/init";
import { generateAgentIntro } from "@/lib/agentIntro";

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseTables();
    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const { agentId, force } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const userEmail = (
      body.userEmail ||
      session?.user?.email ||
      "user@workspace.com"
    ).toLowerCase().trim();

    // 1. Fetch agent record
    const [agentRecord] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId));

    if (!agentRecord) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // 2. Check if chat history already exists for this agent and user
    const existingChats = await db
      .select()
      .from(agentChats)
      .where(
        and(
          eq(agentChats.agentId, agentId),
          eq(agentChats.userEmail, userEmail)
        )
      )
      .orderBy(asc(agentChats.createdAt));

    if (existingChats.length > 0 && !force) {
      return NextResponse.json({
        alreadyIntroduced: true,
        messagesCount: existingChats.length,
      });
    }

    // 3. Fetch connected integrations
    let connectorTypes: string[] = [];
    try {
      const activeConnectors = await db
        .select({ type: agentConnectors.connectorType })
        .from(agentConnectors)
        .where(
          and(
            eq(agentConnectors.agentId, agentId),
            eq(agentConnectors.status, "connected")
          )
        );
      connectorTypes = activeConnectors.map((c) => c.type);
    } catch (err) {
      console.warn("Could not load agent connectors for intro:", err);
    }

    // 4. Generate the rich introductory message & starter prompts
    const intro = generateAgentIntro(agentRecord, connectorTypes);

    // 5. Persist the introductory message as the first chat in the database
    const [savedChat] = await db
      .insert(agentChats)
      .values({
        agentId: String(agentId),
        userEmail,
        sender: "agent",
        text: intro.text,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: {
        id: savedChat.id,
        author: "agent",
        text: savedChat.text,
        createdAt: savedChat.createdAt,
      },
      suggestedPrompts: intro.prompts,
    });
  } catch (err: any) {
    console.error("POST /api/chat/intro error:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
