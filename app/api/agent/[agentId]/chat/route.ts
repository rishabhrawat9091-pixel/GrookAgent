import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { and, eq } from "drizzle-orm"

import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/db"
import { agents } from "@/db/schema"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (typeof value !== "object" || value === null) return false

  const message = value as { role?: unknown; content?: unknown }
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { agentId } = await params
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  let body: { messages?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0 || !body.messages.every(isChatMessage)) {
    return NextResponse.json({ error: "A non-empty messages array is required" }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Chat is not configured" }, { status: 503 })
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are ${agent.name}. Follow these instructions: ${agent.instructions}`,
          },
          ...body.messages,
        ],
      }),
    })

    if (!response.ok) {
      console.error("Groq chat request failed", response.status)
      return NextResponse.json({ error: "Unable to generate a response" }, { status: 502 })
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const message = payload.choices?.[0]?.message?.content?.trim()
    if (!message) {
      return NextResponse.json({ error: "Chat provider returned an empty response" }, { status: 502 })
    }

    return NextResponse.json({ message })
  } catch (error) {
    console.error("Chat request failed", error)
    return NextResponse.json({ error: "Unable to reach the chat provider" }, { status: 502 })
  }
}
