/**
 * Tool Executor — runs connector actions (send email, Slack message, web search)
 * using credentials stored in the DB for the given agent.
 *
 * Gmail sending uses Nodemailer + App Password (SMTP) — no OAuth redirect needed.
 */

import nodemailer from "nodemailer";

export type ToolCall = {
  tool: string;
  args: Record<string, string>;
};

export type ToolResult = {
  tool: string;
  success: boolean;
  output: string;
};

// ─── Gmail via Nodemailer SMTP + App Password ─────────────────────────────────
async function sendGmailEmail(
  args: Record<string, string>,
  config: Record<string, string> = {}
): Promise<ToolResult> {
  // Support flexible argument key names from LLM
  const to = args.to || args.recipient || args.email || args.receiver;
  const subject = args.subject || args.title || "No Subject";
  const body = args.body || args.text || args.message || args.content || "";

  // Support credentials from connector config or environment variables
  const userEmail =
    config.userEmail ||
    process.env.GMAIL_USER ||
    process.env.EMAIL_USER ||
    "";

  const rawPassword =
    config.appPassword ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GMAIL_PASS ||
    process.env.EMAIL_PASS ||
    process.env.EMAIL_PASSWORD ||
    "";

  if (!userEmail) {
    return {
      tool: "send_email",
      success: false,
      output:
        "Sender email is not configured. Please set GMAIL_USER in your .env or configure Gmail in Connected Tools.",
    };
  }

  if (!rawPassword) {
    return {
      tool: "send_email",
      success: false,
      output:
        "Gmail App Password is missing. Please set GMAIL_APP_PASSWORD in your .env or configure it in Connected Tools (Google Account → Security → 2-Step Verification → App Passwords).",
    };
  }

  if (!to || !body) {
    const missing = [!to && "recipient (to)", !body && "body/text"].filter(Boolean).join(", ");
    return {
      tool: "send_email",
      success: false,
      output: `Cannot send email — please provide: ${missing}.`,
    };
  }

  const cleanEmail = userEmail.trim();
  const cleanPassword = rawPassword.trim().replace(/\s+/g, ""); // strip any spaces (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
  const fromName = process.env.GMAIL_FROM_NAME || "Ollama Agent";

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // SSL
      auth: {
        user: cleanEmail,
        pass: cleanPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${cleanEmail}>`,
      to: to.trim(),
      subject,
      text: body,
      html: args.html || undefined,
    });

    return {
      tool: "send_email",
      success: true,
      output: `✅ Email sent successfully to **${to}** with subject "${subject}" (Message ID: ${info.messageId})`,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const hint = errMsg.includes("Invalid login") || errMsg.includes("535")
      ? " — Make sure 2-Step Verification is enabled and you are using a 16-character Google App Password (not your regular Gmail password)."
      : errMsg.includes("getaddrinfo")
      ? " — Network connection error or Gmail SMTP host is unreachable."
      : "";
    return {
      tool: "send_email",
      success: false,
      output: `Failed to send email via Gmail SMTP: ${errMsg}${hint}`,
    };
  }
}

// ─── Slack via Bot Token ──────────────────────────────────────────────────────
async function sendSlackMessage(
  args: Record<string, string>,
  config: Record<string, string>
): Promise<ToolResult> {
  const { channel, text } = args;
  const botToken = config.botToken || config.accessToken;

  if (!botToken) {
    return {
      tool: "send_slack_message",
      success: false,
      output:
        "Slack Bot Token is missing. Please reconnect Slack in the agent's Connected Tools settings.",
    };
  }

  const targetChannel = channel || config.defaultChannel || "#general";

  if (!text) {
    return {
      tool: "send_slack_message",
      success: false,
      output: "Cannot send Slack message — no text provided.",
    };
  }

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: targetChannel, text }),
    });

    const data = (await res.json()) as { ok: boolean; error?: string; ts?: string };

    if (!data.ok) {
      return {
        tool: "send_slack_message",
        success: false,
        output: `Slack API error: ${data.error || "unknown error"}`,
      };
    }

    return {
      tool: "send_slack_message",
      success: true,
      output: `✅ Slack message sent to **${targetChannel}** (ts: ${data.ts})`,
    };
  } catch (err: any) {
    return {
      tool: "send_slack_message",
      success: false,
      output: `Failed to send Slack message: ${err?.message || String(err)}`,
    };
  }
}

// ─── Web Search via Tavily ────────────────────────────────────────────────────
async function webSearch(
  args: Record<string, string>,
  config: Record<string, string>
): Promise<ToolResult> {
  const { query } = args;
  const apiKey = config.apiKey || config.accessToken;

  if (!query) {
    return { tool: "web_search", success: false, output: "No search query provided." };
  }

  if (!apiKey) {
    return {
      tool: "web_search",
      success: false,
      output:
        "Web Research API key is missing. Please reconnect Web Research in the agent's Connected Tools settings.",
    };
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: Number(config.maxResults) || 5,
      }),
    });

    if (!res.ok) {
      return {
        tool: "web_search",
        success: false,
        output: `Web search failed: ${res.statusText}`,
      };
    }

    const data = (await res.json()) as {
      results?: Array<{ title: string; url: string; content: string }>;
    };

    const results = (data.results || [])
      .slice(0, 5)
      .map((r, i) => `[${i + 1}] **${r.title}**\n${r.url}\n${r.content}`)
      .join("\n\n");

    return {
      tool: "web_search",
      success: true,
      output: results || "No results found.",
    };
  } catch (err: any) {
    return {
      tool: "web_search",
      success: false,
      output: `Web search error: ${err?.message || String(err)}`,
    };
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export async function executeTool(
  toolCall: ToolCall,
  connectors: Array<{ connectorType: string; config: Record<string, string> | null }>
): Promise<ToolResult> {
  const getConfig = (type: string) =>
    (connectors.find((c) => c.connectorType === type)?.config ?? {}) as Record<string, string>;

  switch (toolCall.tool) {
    case "send_email":
      return sendGmailEmail(toolCall.args, getConfig("gmail"));

    case "send_slack_message":
      return sendSlackMessage(toolCall.args, getConfig("slack"));

    case "web_search":
      return webSearch(toolCall.args, getConfig("web"));

    default:
      return {
        tool: toolCall.tool,
        success: false,
        output: `Unknown tool: "${toolCall.tool}". Available tools: send_email, send_slack_message, web_search.`,
      };
  }
}
