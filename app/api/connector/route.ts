import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { agentConnectors, agents } from "@/db/schema";

/** POST /api/connector — save (upsert) connector credentials for an agent */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { agentId, connectorType, credentials } = body as {
      agentId: string;
      connectorType: string;
      credentials: Record<string, string>;
    };

    if (!agentId || !connectorType || !credentials) {
      return NextResponse.json(
        { error: "agentId, connectorType, and credentials are required" },
        { status: 400 }
      );
    }

    // Verify the agent belongs to this user
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.userEmail, session.user.email)
        )
      );

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Upsert connector — update if exists, otherwise insert
    const existing = await db
      .select()
      .from(agentConnectors)
      .where(
        and(
          eq(agentConnectors.agentId, agentId),
          eq(agentConnectors.connectorType, connectorType)
        )
      );

    let result;

    if (existing.length > 0) {
      result = await db
        .update(agentConnectors)
        .set({
          status: "connected",
          clientId: credentials.clientId ?? null,
          clientSecret: credentials.clientSecret ?? null,
          userEmail: credentials.userEmail ?? null,
          scope: credentials.scope ?? null,
          config: credentials as Record<string, unknown>,
        })
        .where(
          and(
            eq(agentConnectors.agentId, agentId),
            eq(agentConnectors.connectorType, connectorType)
          )
        )
        .returning();
    } else {
      result = await db
        .insert(agentConnectors)
        .values({
          agentId,
          connectorType,
          status: "connected",
          clientId: credentials.clientId ?? null,
          clientSecret: credentials.clientSecret ?? null,
          userEmail: credentials.userEmail ?? null,
          scope: credentials.scope ?? null,
          config: credentials as Record<string, unknown>,
        })
        .returning();
    }

    return NextResponse.json(
      { message: "Connector saved successfully", connector: result[0] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Connector POST error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

/** GET /api/connector?agentId=... — get all connectors for an agent */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    // Verify the agent belongs to this user
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.userEmail, session.user.email)
        )
      );

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const connectors = await db
      .select()
      .from(agentConnectors)
      .where(
        and(
          eq(agentConnectors.agentId, agentId),
          eq(agentConnectors.status, "connected")
        )
      );

    return NextResponse.json({ connectors }, { status: 200 });
  } catch (error) {
    console.error("Connector GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** DELETE /api/connector?agentId=...&connectorType=... — disconnect a connector */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const connectorType = searchParams.get("connectorType");

    if (!agentId || !connectorType) {
      return NextResponse.json(
        { error: "agentId and connectorType are required" },
        { status: 400 }
      );
    }

    // Verify the agent belongs to this user
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.userEmail, session.user.email)
        )
      );

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await db
      .update(agentConnectors)
      .set({ status: "disconnected" })
      .where(
        and(
          eq(agentConnectors.agentId, agentId),
          eq(agentConnectors.connectorType, connectorType)
        )
      );

    return NextResponse.json(
      { message: "Connector disconnected successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Connector DELETE error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
