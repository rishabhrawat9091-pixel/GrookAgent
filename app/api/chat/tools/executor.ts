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
      output: `Email sent successfully to **${to}** with subject "${subject}" (Message ID: ${info.messageId})`,
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
      output: `Slack message sent to **${targetChannel}** (ts: ${data.ts})`,
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

// ─── Employee Management Tools (DB — uses `users` table with role='employee') ─
async function handleAddEmployee(args: Record<string, string>): Promise<ToolResult> {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const crypto = await import("crypto");

  const name = (args.name || args.employeeName || args.clientName || "").trim();
  const email = (args.email || args.employeeEmail || args.userEmail || "").toLowerCase().trim();
  const role = "employee"; // always employee in this tool
  const department = (args.department || args.dept || "General").trim();
  const salary = args.salary ? Number(args.salary) : 0;

  if (!email) {
    return {
      tool: "add_employee",
      success: false,
      output: "Cannot add employee: employee email address is required.",
    };
  }

  const generatedPass = `Emp#${Math.floor(1000 + Math.random() * 9000)}!${crypto.randomBytes(2).toString("hex")}`;
  const finalPassword = (args.password || args.employeePassword || "").trim() || generatedPass;
  const finalName = name || email.split("@")[0];

  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existing.length > 0) {
      const [updated] = await db
        .update(users)
        .set({
          name: finalName,
          password: finalPassword,
          role,
          department,
          salary,
        })
        .where(eq(users.email, email))
        .returning();

      return {
        tool: "add_employee",
        success: true,
        output: `Security Bot — Employee Credentials Updated\n\n- Name: ${updated.name}\n- Email: ${updated.email}\n- Password: ${updated.password}\n- Role/Dept: ${updated.role} (${updated.department})\n- User ID: ${updated.id}\n- Sign In: /sign-in\n\nThe employee can now sign in immediately using these credentials.`,
      };
    }

    const [inserted] = await db
      .insert(users)
      .values({
        name: finalName,
        email,
        password: finalPassword,
        role,
        department,
        salary,
      })
      .returning();

    return {
      tool: "add_employee",
      success: true,
      output: `Security Bot — Employee Credentials Created\n\n- Name: ${inserted.name}\n- Email: ${inserted.email}\n- Password: ${inserted.password}\n- Role: ${inserted.role}\n- Department: ${inserted.department}\n- User ID: ${inserted.id}\n- Sign In: /sign-in\n\nSaved in the database. Share these credentials with the employee to grant system access.`,
    };
  } catch (err: any) {
    return {
      tool: "add_employee",
      success: false,
      output: `Failed to create employee credentials: ${err?.message || String(err)}`,
    };
  }
}

async function handleDeleteEmployee(args: Record<string, string>): Promise<ToolResult> {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq, and } = await import("drizzle-orm");

  const email = (args.email || args.employeeEmail || "").toLowerCase().trim();
  const id = (args.id || args.employeeId || "").trim();

  if (!email && !id) {
    return {
      tool: "delete_employee",
      success: false,
      output: "Please specify the employee email or ID to delete.",
    };
  }

  try {
    let deleted;
    if (email) {
      deleted = await db
        .delete(users)
        .where(and(eq(users.email, email), eq(users.role, "employee")))
        .returning();
    } else {
      const parsedId = Number(id);
      if (!isNaN(parsedId)) {
        deleted = await db
          .delete(users)
          .where(and(eq(users.id, parsedId), eq(users.role, "employee")))
          .returning();
      }
    }

    if (!deleted || deleted.length === 0) {
      return {
        tool: "delete_employee",
        success: false,
        output: `No employee found with ${email ? `email "${email}"` : `ID "${id}"`}.`,
      };
    }

    return {
      tool: "delete_employee",
      success: true,
      output: `Employee "${deleted[0].name}" (${deleted[0].email}) has been deleted from the database.`,
    };
  } catch (err: any) {
    return {
      tool: "delete_employee",
      success: false,
      output: `Failed to delete employee: ${err?.message || String(err)}`,
    };
  }
}

async function handleListEmployees(): Promise<ToolResult> {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  try {
    const list = await db.select().from(users).where(eq(users.role, "employee"));
    if (list.length === 0) {
      return {
        tool: "list_employees",
        success: true,
        output: "No employees currently in database.",
      };
    }

    const formatted = list
      .map(
        (e, i) =>
          `${i + 1}. ${e.name} (${e.email}) — Role: ${e.role} | Dept: ${e.department} | ID: ${e.id}`
      )
      .join("\n");

    return {
      tool: "list_employees",
      success: true,
      output: `Employees (${list.length}):\n\n${formatted}`,
    };
  } catch (err: any) {
    return {
      tool: "list_employees",
      success: false,
      output: `Failed to list employees: ${err?.message || String(err)}`,
    };
  }
}

// ─── Platform Users Management Tools (All Roles: admin, employee, client) ───
async function handleListUsers(): Promise<ToolResult> {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");

  try {
    const list = await db.select().from(users);
    if (list.length === 0) {
      return {
        tool: "list_users",
        success: true,
        output: "No registered users found in the database.",
      };
    }

    const formatted = list
      .map((u, i) => {
        const roleLabel = u.role === "admin" ? "Admin" : "Employee";
        const dateStr = u.createdAt ? new Date(u.createdAt).toISOString().split("T")[0] : "N/A";
        return `${i + 1}. ${u.name || "Unnamed"} (${u.email})
   - Role: ${roleLabel} (${u.role})
   - Department: ${u.department || "General"} | Salary: $${u.salary ?? 0} | Credits: ${u.credits ?? 0}
   - User ID: ${u.id} | Joined: ${dateStr}`;
      })
      .join("\n\n");

    return {
      tool: "list_users",
      success: true,
      output: `Platform Users Directory (${list.length} Total):\n\n${formatted}`,
    };
  } catch (err: any) {
    return {
      tool: "list_users",
      success: false,
      output: `Failed to list users: ${err?.message || String(err)}`,
    };
  }
}

async function handleChangeUserRole(args: Record<string, string>): Promise<ToolResult> {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const email = (args.email || args.userEmail || "").toLowerCase().trim();
  const id = (args.id || args.userId || "").trim();
  const targetRole = (args.role || args.newRole || "").toLowerCase().trim();

  if (!email && !id) {
    return {
      tool: "change_user_role",
      success: false,
      output: "Please specify the user's email address or ID to change their role.",
    };
  }

  if (!targetRole) {
    return {
      tool: "change_user_role",
      success: false,
      output: "Please specify the new role for the user (supported roles: 'admin', 'employee').",
    };
  }

  const validRoles = ["admin", "employee"];
  if (!validRoles.includes(targetRole)) {
    return {
      tool: "change_user_role",
      success: false,
      output: `Invalid role "${targetRole}". Permitted roles are: ${validRoles.join(", ")}.`,
    };
  }

  try {
    let targetUser;
    if (email) {
      const [found] = await db.select().from(users).where(eq(users.email, email));
      targetUser = found;
    } else {
      const parsedId = Number(id);
      if (!isNaN(parsedId)) {
        const [found] = await db.select().from(users).where(eq(users.id, parsedId));
        targetUser = found;
      }
    }

    if (!targetUser) {
      return {
        tool: "change_user_role",
        success: false,
        output: `No user found matching ${email ? `email "${email}"` : `ID "${id}"`}.`,
      };
    }

    const previousRole = targetUser.role;
    const [updated] = await db
      .update(users)
      .set({ role: targetRole })
      .where(eq(users.id, targetUser.id))
      .returning();

    return {
      tool: "change_user_role",
      success: true,
      output: `Role Modification Successful\n\n- Name: ${updated.name || "N/A"}\n- Email: ${updated.email}\n- Previous Role: ${previousRole}\n- New Role: ${targetRole.toUpperCase()} (${targetRole})\n- User ID: ${updated.id}\n\nThe user's permissions and access privileges have been immediately updated to ${targetRole}.`,
    };
  } catch (err: any) {
    return {
      tool: "change_user_role",
      success: false,
      output: `Failed to change user role: ${err?.message || String(err)}`,
    };
  }
}

// ─── Bot / Agent Configuration Tools (Admin Only) ───────────────────────────
async function handleUpdateBotConfig(
  args: Record<string, string>,
  context: { agentId?: string; userEmail?: string; userRole?: string } = {}
): Promise<ToolResult> {
  const { db } = await import("@/db");
  const { agents, users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const name = (args.name || args.botName || args.agentName || "").trim();
  const instructions = (args.instructions || args.description || args.prompt || args.config || "").trim();
  const agentId = (args.agentId || args.id || context.agentId || "").trim();
  const adminEmail = (args.adminEmail || context.userEmail || "").trim();

  // Verify admin authorization
  if (context.userRole && context.userRole !== "admin") {
    return {
      tool: "update_bot_config",
      success: false,
      output: "Access Denied: Only administrators have permission to change bot configuration.",
    };
  }

  if (adminEmail) {
    const [dbUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, adminEmail.toLowerCase().trim()));
    if (dbUser && dbUser.role !== "admin") {
      return {
        tool: "update_bot_config",
        success: false,
        output: `Access Denied: User "${adminEmail}" has role "${dbUser.role}". Only administrators have permission to change bot configuration.`,
      };
    }
  }

  try {
    let targetAgent;
    if (agentId) {
      const [found] = await db.select().from(agents).where(eq(agents.id, agentId));
      targetAgent = found;
    } else {
      const list = await db.select().from(agents).limit(1);
      targetAgent = list[0];
    }

    if (!targetAgent) {
      return {
        tool: "update_bot_config",
        success: false,
        output: "No bot found in database to configure.",
      };
    }

    const updates: Partial<{ name: string; instructions: string }> = {};
    if (name) updates.name = name;
    if (instructions) updates.instructions = instructions;

    if (Object.keys(updates).length === 0) {
      return {
        tool: "update_bot_config",
        success: false,
        output: "Please provide the new name or instructions to update the bot configuration.",
      };
    }

    const [updated] = await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, targetAgent.id))
      .returning();

    return {
      tool: "update_bot_config",
      success: true,
      output: `Bot Configuration Updated Successfully\n\n- Bot ID: ${updated.id}\n- Bot Name: ${updated.name}\n- Instructions: ${updated.instructions}\n\nThe updated configuration is now active in the platform.`,
    };
  } catch (err: any) {
    return {
      tool: "update_bot_config",
      success: false,
      output: `Failed to update bot configuration: ${err?.message || String(err)}`,
    };
  }
}

async function handleGetBotConfig(
  args: Record<string, string>,
  context: { agentId?: string } = {}
): Promise<ToolResult> {
  const { db } = await import("@/db");
  const { agents } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const agentId = (args.agentId || args.id || context.agentId || "").trim();

  try {
    let targetAgent;
    if (agentId) {
      const [found] = await db.select().from(agents).where(eq(agents.id, agentId));
      targetAgent = found;
    } else {
      const list = await db.select().from(agents).limit(1);
      targetAgent = list[0];
    }

    if (!targetAgent) {
      return {
        tool: "get_bot_config",
        success: false,
        output: "No bot configuration found in the database.",
      };
    }

    return {
      tool: "get_bot_config",
      success: true,
      output: `Current Bot Configuration\n\n- Bot ID: ${targetAgent.id}\n- Bot Name: ${targetAgent.name}\n- Instructions: ${targetAgent.instructions}\n- Created: ${targetAgent.createdAt ? new Date(targetAgent.createdAt).toISOString().split("T")[0] : "N/A"}`,
    };
  } catch (err: any) {
    return {
      tool: "get_bot_config",
      success: false,
      output: `Failed to get bot configuration: ${err?.message || String(err)}`,
    };
  }
}


async function handleListAgents(): Promise<ToolResult> {
  const { db } = await import("@/db");
  const { agents } = await import("@/db/schema");

  try {
    const rows = await db.select().from(agents);
    if (rows.length === 0) {
      return { tool: "list_agents", success: true, output: "No bots are registered on the platform yet." };
    }

    const formatted = rows.map((a, i) =>
      `${i + 1}. ${a.name}\n   ID: ${a.id}\n   Owner: ${a.userEmail}\n   Created: ${new Date(a.createdAt).toLocaleDateString()}`
    ).join("\n\n");

    return { tool: "list_agents", success: true, output: `Available Bots (${rows.length} total):\n\n${formatted}` };
  } catch (err: any) {
    return { tool: "list_agents", success: false, output: `Failed to list agents: ${err?.message || String(err)}` };
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export async function executeTool(
  toolCall: ToolCall,
  connectors: Array<{ connectorType: string; config: Record<string, string> | null }> = [],
  context: { agentId?: string; userEmail?: string; userRole?: string } = {}
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

    case "list_agents":
    case "get_agents":
      return handleListAgents();

    case "list_employees":
    case "get_employees":
      return handleListEmployees();

    case "add_employee":
    case "create_employee":
      return handleAddEmployee(toolCall.args);

    case "delete_employee":
    case "remove_employee":
      return handleDeleteEmployee(toolCall.args);

    case "list_users":
    case "get_users":
      return handleListUsers();

    case "change_user_role":
    case "update_user_role":
      return handleChangeUserRole(toolCall.args);

    // Bot Configuration tools (Admin Only)
    case "update_bot_config":
    case "change_bot_config":
    case "configure_bot":
    case "update_agent_config":
    case "change_agent_config":
      return handleUpdateBotConfig(toolCall.args, context);

    case "get_bot_config":
    case "view_bot_config":
    case "bot_config":
    case "agent_config":
      return handleGetBotConfig(toolCall.args, context);

    default:
      return {
        tool: toolCall.tool,
        success: false,
        output: `Unknown tool: "${toolCall.tool}". Available tools: list_agents, list_employees, add_employee, delete_employee, list_users, change_user_role, update_bot_config, get_bot_config, send_email, send_slack_message, web_search.`,
      };
  }
}

