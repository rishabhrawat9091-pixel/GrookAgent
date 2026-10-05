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
