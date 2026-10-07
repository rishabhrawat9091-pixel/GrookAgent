import { inngest } from "./client";
import { db } from "@/db";
import { agentConnectors } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Example 1: Event-driven Background Job
 * Triggered by sending an event with name: 'app/task.process'
 */
export const processTaskBackgroundJob = inngest.createFunction(
  {
    id: "process-task-job",
    name: "Process Task Background Job",
    retries: 3,
  },
  { event: "app/task.process" },
  async ({ event, step }) => {
    const initialResult = await step.run("init-task", async () => {
      console.log("Starting background processing for task payload:", event.data);
      return { taskId: event.data?.taskId || "task_default", status: "initialized" };
    });

    await step.sleep("wait-for-processing", "2s");

    const completedResult = await step.run("complete-task", async () => {
      console.log("Completed processing task:", initialResult.taskId);
      return {
        taskId: initialResult.taskId,
        status: "completed",
        completedAt: new Date().toISOString(),
      };
    });

    return { success: true, data: completedResult };
  }
);

/**
 * Example 2: Daily Sync Scheduled Cron Job
 */
export const dailySyncScheduledJob = inngest.createFunction(
  {
    id: "daily-sync-job",
    name: "Daily Sync Scheduled Cron Job",
  },
  { cron: "0 0 * * *" },
  async ({ step }) => {
    const syncResult = await step.run("run-scheduled-sync", async () => {
      console.log("Running scheduled daily maintenance & sync...");
      return { syncedRecords: 0, syncedAt: new Date().toISOString() };
    });

    return { success: true, summary: syncResult };
  }
);

/**
 * Marketing Inbox Monitor — runs every 15 minutes
 * Polls Gmail inbox for all agents that have Gmail connected,
 * classifies marketing emails, saves them as notifications.
 */
export const marketingInboxMonitorJob = inngest.createFunction(
  {
    id: "marketing-inbox-monitor",
    name: "Marketing Email Inbox Monitor",
    retries: 2,
  },
  { cron: "*/15 * * * *" }, // every 15 minutes
  async ({ step }) => {
    // Step 1: Find all agents with Gmail connected
    const gmailAgents = await step.run("find-gmail-agents", async () => {
      const rows = await db
        .select({ agentId: agentConnectors.agentId })
        .from(agentConnectors)
        .where(
          eq(agentConnectors.connectorType, "gmail")
        );
      return rows.map((r) => r.agentId);
    });

    if (gmailAgents.length === 0) {
      return { success: true, polled: 0, message: "No Gmail-connected agents found" };
    }

    // Step 2: Poll each agent's inbox
    let totalNew = 0;
    const results: Array<{ agentId: string; newCount: number }> = [];

    for (const agentId of gmailAgents) {
      const result = await step.run(`poll-inbox-${agentId}`, async () => {
        const { pollGmailInbox } = await import("@/app/api/chat/tools/gmailMonitor");
        return pollGmailInbox(agentId);
      });

      totalNew += result.newCount;
      results.push({ agentId, newCount: result.newCount });
      console.log(`[inbox-monitor] Agent ${agentId}: ${result.newCount} new marketing emails`);
    }

    return {
      success: true,
      polled: gmailAgents.length,
      totalNewNotifications: totalNew,
      results,
    };
  }
);

/**
 * On-demand inbox poll — triggered when user manually clicks "Refresh"
 * Event name: 'agent/inbox.poll'
 * Payload: { agentId: string }
 */
export const onDemandInboxPollJob = inngest.createFunction(
  {
    id: "on-demand-inbox-poll",
    name: "On-Demand Agent Inbox Poll",
    retries: 1,
  },
  { event: "agent/inbox.poll" },
  async ({ event, step }) => {
    const { agentId } = event.data as { agentId: string };

    if (!agentId) return { success: false, error: "agentId missing" };

    const result = await step.run("poll-inbox", async () => {
      const { pollGmailInbox } = await import("@/app/api/chat/tools/gmailMonitor");
      return pollGmailInbox(agentId);
    });

    return { success: true, agentId, ...result };
  }
);

/**
 * Weekly Market Digest — runs every Monday at 09:00 UTC
 * Queries Pinecone for the latest market knowledge, generates a market
 * analysis summary via the Ollama market-analyst model, and saves it
 * as a notification on every admin-owned agent so admins see it in inbox.
 */
export const weeklyMarketDigestJob = inngest.createFunction(
  {
    id: "weekly-market-digest",
    name: "Weekly Market Intelligence Digest",
    retries: 2,
  },
  { cron: "0 9 * * 1" }, // Every Monday at 09:00 UTC
  async ({ step }) => {
    // Step 1: Pull latest market knowledge from Pinecone
    const marketContext = await step.run("fetch-pinecone-market-data", async () => {
      try {
        const pineconeConfigured =
          process.env.PINECONE_API_KEY &&
          process.env.PINECONE_API_KEY !== "your_pinecone_api_key" &&
          process.env.PINECONE_INDEX_NAME &&
          process.env.HUGGINGFACE_API_KEY &&
          process.env.HUGGINGFACE_API_KEY !== "your_huggingface_api_key";

        if (!pineconeConfigured) {
          return { text: "", skipped: true };
        }

        const { embedding } = await import("@/app/api/documentprocess/embeddings/embedded");
        const { queryPinecone } = await import("@/app/api/documentprocess/vectordb/pineconedb");

        // Query with a broad market intelligence prompt
        const queryVectors = await embedding({ chunks: ["latest market trends industry analysis competitive intelligence weekly update"] });
        if (!queryVectors[0]?.length) return { text: "", skipped: true };

        const chunks = await queryPinecone({ vector: queryVectors[0], topK: 8 });
        const text = chunks
          .filter((c) => c.text?.trim())
          .map((c, i) => `[Source ${i + 1}]: ${c.text.trim()}`)
          .join("\n\n");

        return { text, skipped: false };
      } catch (err: any) {
        console.error("[weekly-digest] Pinecone fetch error:", err?.message);
        return { text: "", skipped: true };
      }
    });

    if (marketContext.skipped || !marketContext.text) {
      return { success: true, message: "No Pinecone data available — digest skipped." };
    }

    // Step 2: Generate analysis via Ollama market-analyst model
    const digestContent = await step.run("generate-market-analysis", async () => {
      const { marketAnalystPrompt } = await import("@/app/api/chat/prompt/market");
      const axios = (await import("axios")).default;

      const systemPrompt = `${marketAnalystPrompt}\n\n## WEEKLY DIGEST MODE\nYou are generating the Weekly Market Intelligence Digest. Analyze the following knowledge base data and produce a structured, executive-level market analysis report. Include: key trends, opportunities, risks, and actionable recommendations. Be concise and data-driven.`;

      const messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate the weekly market digest based on this data:\n\n${marketContext.text}`,
        },
      ];

      try {
        const response = await axios.post(
          "http://127.0.0.1:11434/api/chat",
          { model: "qwen3:4b", messages, stream: false, think: false },
          { timeout: 120000 }
        );
        let content = response.data?.message?.content || "";
        // Strip <think> blocks
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        return content || "Weekly digest generation returned no content.";
      } catch (err: any) {
        return `Weekly digest unavailable: ${err?.message || "Ollama connection error"}`;
      }
    });

    // Step 3: Save digest as notification on each admin agent
    const saved = await step.run("save-digest-notifications", async () => {
      const { db } = await import("@/db");
      const { agents, users, agentNotifications } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");

      // Find all admin users
      const admins = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.role, "admin"));

      if (admins.length === 0) return { count: 0 };

      const adminEmails = admins.map((a) => a.email);

      // Find agents owned by admins
      let savedCount = 0;
      for (const email of adminEmails) {
        const adminAgents = await db
          .select()
          .from(agents)
          .where(eq(agents.userEmail, email));

        for (const agent of adminAgents) {
          try {
            await db.insert(agentNotifications).values({
              agentId: agent.id,
              type: "generic",
              title: `Weekly Market Digest — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
              body: digestContent,
              source: "Market Intelligence",
              isRead: "false",
            });
            savedCount++;
          } catch (err) {
            console.error(`[weekly-digest] Failed to save notification for agent ${agent.id}:`, err);
          }
        }
      }

      return { count: savedCount };
    });

    return {
      success: true,
      digestLength: digestContent.length,
      notificationsSaved: saved.count,
      message: `Weekly market digest generated and delivered to ${saved.count} agent(s).`,
    };
  }
);

