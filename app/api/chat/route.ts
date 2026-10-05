import { NextRequest, NextResponse } from "next/server";
import { marketAnalystPrompt } from "@/app/api/chat/prompt/market";
import axios from "axios";
import { embedding } from "@/app/api/documentprocess/embeddings/embedded";
import { queryPinecone } from "@/app/api/documentprocess/vectordb/pineconedb";
import { db } from "@/db";
import { agentConnectors } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { executeTool, type ToolCall } from "./tools/executor";

// ─── System prompt addendum that teaches the model how to call tools ─────────
function buildToolSystemPrompt(connectorTypes: string[]): string {
  if (!Array.isArray(connectorTypes) || connectorTypes.length === 0) return "";

  const toolDefs: Record<string, string> = {
    gmail: `- send_email: Send an email via Gmail SMTP.
  Arguments: { "to": "<recipient email address>", "subject": "<email subject>", "body": "<email body text>" }`,

    slack: `- send_slack_message: Post a message to a Slack channel.
  Arguments: { "channel": "<#channel-name or ID>", "text": "<message text>" }`,

    web: `- web_search: Search the web for up-to-date information.
  Arguments: { "query": "<search query>" }`,

    calendar: `- (Calendar integration available — describe scheduling actions in natural language)`,

    notion: `- (Notion integration available — describe database/page actions in natural language)`,
  };

  const toolsList = connectorTypes
    .map((t) => (typeof t === "string" ? toolDefs[t] : ""))
    .filter(Boolean)
    .join("\n");

  if (!toolsList.trim()) return "";

  return `

---
## Tool Instructions

You have access to the following tools:
${toolsList}

### Tool Call Format
When the user asks you to send an email or perform an action, output ONLY a JSON code block in this format:

\`\`\`tool_call
{
  "tool": "send_email",
  "args": {
    "to": "recipient@example.com",
    "subject": "Subject of the email",
    "body": "Email body content goes here"
  }
}
\`\`\`

### Guidelines
1. The backend server is already authenticated and handles SMTP sending.
2. Never ask the user for passwords, App Passwords, or login credentials.
3. When the user asks to send an email, output the \`\`\`tool_call block immediately.
4. After the tool execution result is returned, summarize what happened in a helpful confirmation.
---`;
}

// ─── Parse a tool_call JSON block from the model's response ─────────────────
function parseToolCall(content: string): ToolCall | null {
  if (!content) return null;

  // Pattern 1: ```tool_call ... ``` or ```json ... ``` or ``` ... ```
  const blockMatch =
    content.match(/```(?:tool_call|json)?\s*([\s\S]*?)```/) ||
    content.match(/\{[\s\S]*?"(?:tool|name|function)"\s*:[\s\S]*?\}/);

  const candidate = blockMatch ? (blockMatch[1] ?? blockMatch[0]).trim() : content.trim();

  try {
    const parsed = JSON.parse(candidate);
    
    // Format A: { tool: "send_email", args: { ... } }
    if (parsed.tool && typeof parsed.args === "object") {
      return {
        tool: String(parsed.tool),
        args: parsed.args as Record<string, string>,
      };
    }

    // Format B: { name: "send_email", parameters / arguments: { ... } }
    if (parsed.name && (parsed.parameters || parsed.arguments || parsed.args)) {
      const rawArgs = parsed.parameters || parsed.arguments || parsed.args;
      const argsObj = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
      return {
        tool: String(parsed.name),
        args: argsObj as Record<string, string>,
      };
    }

    // Format C: { function: "send_email", arguments: { ... } }
    if (parsed.function && (parsed.arguments || parsed.args)) {
      const rawArgs = parsed.arguments || parsed.args;
      const argsObj = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
      return {
        tool: typeof parsed.function === "string" ? parsed.function : parsed.function.name,
        args: argsObj as Record<string, string>,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Strip <think> blocks from qwen3 output ──────────────────────────────────
function stripThinking(raw: string): string {
  return raw
    .replace(/<think>[\.\s\S]*?<\/think>/gi, "")
    .replace(/^[\.\s\S]*?<\/think>/i, "")
    .trim()
}

// ─── Call Ollama ─────────────────────────────────────────────────────────────
async function callOllama(
  model: string,
  conversationMessages: Array<{ role: string; content: string }>
): Promise<string> {
  const response = await axios.post(
    "http://127.0.0.1:11434/api/chat",
    { model, messages: conversationMessages, stream: false, think: false },
    { timeout: 120000 }
  );
  return stripThinking(response.data?.message?.content ?? "");
}

// ─── Main route ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, role, messages, model, agentId } = body;

    const userMessage =
      message ||
      (Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1].content
        : "");

    if (!userMessage) {
      return NextResponse.json({ error: "data is not provided" }, { status: 400 });
    }

    // ── Base system prompt ──────────────────────────────────────────────────
    let promptBehavior = "";
    const activeRole = role || "market-analyst";
    switch (activeRole) {
      case "market-analyst":
        promptBehavior = marketAnalystPrompt;
        break;
      default:
        promptBehavior = marketAnalystPrompt;
        break;
    }

    if (!promptBehavior) {
      return NextResponse.json({ error: "role is not found" }, { status: 400 });
    }

    // ── Load connected connectors for this agent ────────────────────────────
    let connectors: Array<{
      connectorType: string;
      config: Record<string, string> | null;
      status: string;
    }> = [];

    if (agentId) {
      try {
        const rows = await db
          .select()
          .from(agentConnectors)
          .where(
            and(
              eq(agentConnectors.agentId, agentId),
              eq(agentConnectors.status, "connected")
            )
          );
        connectors = rows.map((r) => ({
          connectorType: r.connectorType,
          config: r.config as Record<string, string> | null,
          status: r.status,
        }));
      } catch (err: any) {
        console.warn("Failed to load connectors:", err?.message || err);
      }
    }

    const connectorTypes = connectors.map((c) => c.connectorType);

    // Auto-enable Gmail SMTP tool if GMAIL_USER/GMAIL_APP_PASSWORD env vars are set
    const hasSmtpEnv = Boolean(
      (process.env.GMAIL_USER || process.env.EMAIL_USER) &&
      (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD)
    );

    if (hasSmtpEnv && !connectorTypes.includes("gmail")) {
      connectorTypes.push("gmail");
    }

    const hasActionableConnectors = connectorTypes.some((t) =>
      ["gmail", "slack", "web"].includes(t)
    );

    // ── Connector summary for the model ────────────────────────────────────
    let connectorContext = "";
    if (connectors.length > 0 || hasSmtpEnv) {
      const lines = connectorTypes.map((type) => {
        if (type === "gmail") {
          const conn = connectors.find((c) => c.connectorType === "gmail");
          const cfg = conn?.config ?? {};
          const sender = cfg.userEmail || process.env.GMAIL_USER || "authenticated Gmail account";
          return `- GMAIL (Connected & Authenticated): Server is fully configured with App Password to send emails from "${sender}". (Credentials are managed securely on the server; do NOT ask user for passwords)`;
        }
        const conn = connectors.find((c) => c.connectorType === type);
        const cfg = conn?.config ?? {};
        const safeEntries = Object.entries(cfg)
          .filter(
            ([k]) =>
              !["secret", "token", "password", "key", "apikey"].some((s) =>
                k.toLowerCase().includes(s)
              )
          )
          .map(([k, v]) => `    ${k}: ${v}`)
          .join("\n");
        return `- ${type.toUpperCase()} (Connected & Authenticated)${safeEntries ? `\n${safeEntries}` : ""}`;
      });
      connectorContext = `\n\n---\n## Connected Integrations\n${lines.join("\n")}\n---`;
    }

    // ── RAG knowledge context ───────────────────────────────────────────────
    let knowledgeContext = "";
    try {
      const pineconeConfigured =
        process.env.PINECONE_API_KEY &&
        process.env.PINECONE_API_KEY !== "your_pinecone_api_key" &&
        process.env.PINECONE_INDEX_NAME &&
        process.env.PINECONE_INDEX_NAME !== "your_index_name" &&
        process.env.HUGGINGFACE_API_KEY &&
        process.env.HUGGINGFACE_API_KEY !== "your_huggingface_api_key";

      if (pineconeConfigured) {
        const queryVectors = await embedding({ chunks: [userMessage] });
        if (queryVectors.length > 0 && queryVectors[0].length > 0) {
          const chunks = await queryPinecone({ vector: queryVectors[0], topK: 5 });
          if (chunks.length > 0) {
            const relevantText = chunks
              .filter((c) => c.text && c.text.trim().length > 0)
              .map((c, i) => `[Source ${i + 1}]: ${c.text.trim()}`)
              .join("\n\n");
            if (relevantText.length > 0) {
              knowledgeContext = `\n\n---\n## Knowledge Base Context\n${relevantText}\n---`;
            }
          }
        }
      }
    } catch (ragErr: any) {
      console.warn("RAG retrieval skipped:", ragErr?.message || ragErr);
    }

    // ── Build tool instructions if connectors support actions ───────────────
    const toolInstructions = hasActionableConnectors
      ? buildToolSystemPrompt(connectorTypes)
      : "";

    const systemContent =
      promptBehavior + connectorContext + toolInstructions + knowledgeContext;

    // ── Build conversation history ──────────────────────────────────────────
    const historyMessages = Array.isArray(messages) && messages.length > 0
      ? messages.map((m: { role: string; content: string }) => ({
          role: m.role === "agent" ? "assistant" : m.role,
          content: m.content,
        }))
      : [{ role: "user", content: userMessage }];

    const conversationMessages = [
      { role: "system", content: systemContent },
      ...historyMessages,
    ];

    // ── First Ollama call ───────────────────────────────────────────────────
    const ollamaModel = model || "qwen3:4b";
    let firstResponse = await callOllama(ollamaModel, conversationMessages);

    console.log("[chat] First response:", firstResponse.slice(0, 200));

    // ── Agentic tool-call loop (max 3 iterations) ───────────────────────────
    let finalContent = firstResponse;
    let toolResults: string[] = [];
    let iterations = 0;
    const MAX_ITERATIONS = 3;

    let currentResponse = firstResponse;
    let currentMessages = [...conversationMessages];

    while (iterations < MAX_ITERATIONS) {
      const toolCall = parseToolCall(currentResponse);
      if (!toolCall) break; // No tool call — model is done

      iterations++;
      console.log(`[chat] Tool call detected (iter ${iterations}):`, toolCall);

      // Execute the tool
      const result = await executeTool(toolCall, connectors);
      toolResults.push(result.output);

      console.log(`[chat] Tool result:`, result);

      // Feed the result back to the model
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: currentResponse },
        {
          role: "tool",
          content: `Tool "${toolCall.tool}" result:\n${result.output}`,
        },
      ];

      // Next Ollama call to get the final natural-language response
      currentResponse = await callOllama(ollamaModel, currentMessages);
      console.log(`[chat] Response after tool (iter ${iterations}):`, currentResponse.slice(0, 200));
    }

    finalContent = currentResponse;

    // ── If the model STILL outputs a tool_call but we hit max iterations ────
    if (parseToolCall(finalContent)) {
      finalContent =
        "I attempted to perform the action but reached the maximum number of steps. Please try again or check your connected tools configuration.";
    }

    return NextResponse.json({
      data: finalContent,
      message: finalContent,
      usedKnowledge: knowledgeContext.length > 0,
      usedConnectors: connectorTypes.length > 0,
      toolsExecuted: toolResults,
    });
  } catch (error: any) {
    console.error("Chat API error:", error?.message || error);
    const errorMessage =
      error?.response?.data?.error ||
      error?.message ||
      "Unable to connect to Ollama. Ensure Ollama is running on http://127.0.0.1:11434";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
