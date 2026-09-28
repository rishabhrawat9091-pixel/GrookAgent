import { NextRequest } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { authOptions } from "../auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
export async function POST(req: NextRequest) {
    const { agentId, name, description } = await req.json();
    const session = await getServerSession(authOptions);
    if (!agentId || !name || !description) {
        return Response.json({ error: "All fields are required" }, { status: 400 });
    }
    if (session?.user?.email) {
        const result = await db.insert(agents).values({
            id: agentId,
            name,
            instructions: description,
            userEmail: session.user.email
        }).returning();
        return Response.json({ message: "Agent created successfully", result }, { status: 200 });
    }
    else {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
}