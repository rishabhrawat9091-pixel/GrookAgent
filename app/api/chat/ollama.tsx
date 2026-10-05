import { NextRequest, NextResponse } from "next/server";
import { marketAnalystPrompt } from "@/app/api/chat/prompt/market";
import axios from "axios";

export async function POST(request: NextRequest) {
  try {
    const { message, role } = await request.json();

    if (!message || !role) {
      return NextResponse.json(
        { error: "data is not provided" },
        { status: 400 }
      );
    }

    let promptBehavior = "";
    switch (role) {
      case "market-analyst":
        promptBehavior = marketAnalystPrompt;
        break;
      default:
        break;
    }

    if (!promptBehavior) {
      return NextResponse.json(
        { error: "role is not found" },
        { status: 400 }
      );
    }

    const response = await axios.post(
      "http://127.0.0.1:11434/api/chat",
      {
        model: "qwen3:4b",
        messages: [
          { role: "system", content: promptBehavior },
          { role: "user", content: message },
        ],
        stream: false,
        // Disable chain-of-thought for qwen3 thinking models
        think: false,
      },
      { timeout: 120000 }
    );

    const rawContent = response.data?.message?.content ?? "";

    // Strip <think>...</think> blocks and any orphaned </think> tags
    const cleaned = rawContent
      .replace(/<think>[\.\s\S]*?<\/think>/gi, "")
      .replace(/^[\.\s\S]*?<\/think>/i, "")
      .trim();

    return NextResponse.json({ data: cleaned, message: cleaned });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
