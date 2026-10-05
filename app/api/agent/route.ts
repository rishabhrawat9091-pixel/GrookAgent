import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { authOptions } from "../auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { desc, eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    const { agentId, name, description, agentImage } = await req.json();
    const session = await getServerSession(authOptions);
    if (!agentId || !name || !description) {
        return Response.json({ error: "All fields are required" }, { status: 400 });
    }
    if (session?.user?.email) {
        const result = await db.insert(agents).values({
            id: agentId,
            name,
            instructions: description,
            agentImage: agentImage,
            userEmail: session.user.email
        }).returning();
        return Response.json({ message: "Agent created successfully", result, agent: result[0] }, { status: 200 });
    }
    else {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const { searchParams } = new URL(req.url);
        const agentId = searchParams.get("agentId");

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (agentId) {
            const agentConfig = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.userEmail, session.user.email)));
            return NextResponse.json({ agentConfig, agent: agentConfig[0] });
        }

        const agentget = await db.select().from(agents).where(eq(agents.userEmail, session.user.email)).orderBy(desc(agents.createdAt))
        return NextResponse.json(agentget);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const agentId = body.agentId || body.formdata?.agentId;
        const name = body.name || body.formdata?.name;
        const description = body.description || body.formdata?.description;
        const agentImage = body.agentImage || body.formdata?.agentImage;

        const session = await getServerSession(authOptions);
        if (!agentId || !name || !description) {
            return Response.json({ error: "All fields are required" }, { status: 400 });
        }
        if (session?.user?.email) {
            const result = await db.update(agents).set({
                name,
                instructions: description,
                agentImage: agentImage,
                userEmail: session.user.email
            }).where(and(eq(agents.id, agentId), eq(agents.userEmail, session.user.email))).returning();

            return Response.json({ message: "Agent updated successfully", result, agent: result[0] }, { status: 200 });
        }
        else {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
    } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 });
    }
}

export const PATCH = PUT;