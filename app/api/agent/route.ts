import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents, users } from "@/db/schema";
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

        const userEmail = session.user.email.toLowerCase().trim();

        // Fetch user role from DB
        const [dbUser] = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.email, userEmail));
        const userRole = dbUser?.role || (session.user as any)?.role || "employee";

        if (agentId) {
            // For single-agent lookup: return agent config directly if agent exists
            const agentConfig = await db
                .select()
                .from(agents)
                .where(eq(agents.id, agentId));

            if (!agentConfig[0]) {
                return NextResponse.json({ agentConfig: [], agent: null });
            }

            return NextResponse.json({ agentConfig, agent: agentConfig[0] });
        }

        // ── List agents ───────────────────────────────────────────────────────
        // If user is admin, they can see all agents across the workspace
        if (userRole === "admin") {
            const allWorkspaceAgents = await db
                .select()
                .from(agents)
                .orderBy(desc(agents.createdAt));
            return NextResponse.json(allWorkspaceAgents);
        }

        // For non-admins: return own agents
        const ownAgents = await db
            .select()
            .from(agents)
            .where(eq(agents.userEmail, userEmail))
            .orderBy(desc(agents.createdAt));

        if (ownAgents.length === 0) {
            try {
                const [seededBot] = await db.insert(agents).values({
                    name: "Support Hero",
                    instructions: "You are a warm, empathetic customer support specialist. Your goal is to help users resolve issues quickly and politely. Always maintain a kind and encouraging tone. If you are referencing company policies or guides from the knowledge base, explain them clearly in simple terms. If you don't know the answer, politely offer to connect them with a human supervisor.",
                    agentImage: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=market-scout&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff,fef3c7&radius=50",
                    userEmail: userEmail,
                }).returning();
                if (seededBot) {
                    return NextResponse.json([seededBot]);
                }
            } catch (seedErr) {
                console.warn("Could not auto-seed default prebuilt bot:", seedErr);
            }
        }

        return NextResponse.json(ownAgents);
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
        if (!session?.user?.email) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!agentId || !name || !description) {
            return Response.json({ error: "All fields are required" }, { status: 400 });
        }

        // Verify that the user has admin role
        const [currentUser] = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.email, session.user.email.toLowerCase().trim()));

        const userRole = currentUser?.role || (session.user as any)?.role || "employee";
        if (userRole !== "admin") {
            return Response.json(
                { error: "Access denied. Only administrators have permission to change bot configuration." },
                { status: 403 }
            );
        }

        const updateData: Record<string, any> = {
            name,
            instructions: description,
        };
        if (agentImage) {
            updateData.agentImage = agentImage;
        }

        const result = await db.update(agents).set(updateData).where(eq(agents.id, agentId)).returning();

        return Response.json({ message: "Agent updated successfully", result, agent: result[0] }, { status: 200 });
    } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 });
    }
}

export const PATCH = PUT;