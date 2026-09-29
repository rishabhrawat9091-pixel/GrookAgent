import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { authOptions } from "../auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
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
        return Response.json({ message: "Agent created successfully", result }, { status: 200 });
    }
    else {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ "error": "Unauthorized" });
        }

        const agentget = await db.select().from(agents).where(eq(agents.userEmail, session.user.email))
        return NextResponse.json(agentget);
    } catch (error) {
        return NextResponse.json({ "error": error });
    }
}