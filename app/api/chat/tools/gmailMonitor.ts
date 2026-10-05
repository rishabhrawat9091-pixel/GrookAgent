/**
 * Gmail inbox monitor — polls for new marketing-related emails
 * and saves them as notifications in the DB.
 *
 * Uses the Gmail REST API with OAuth access token OR
 * fetches via IMAP if only app password is available (future).
 *
 * Marketing detection: looks for keywords in subject/from.
 */

import { google } from "googleapis";
import { db } from "@/db";
import { agentConnectors, agentNotifications } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const MARKETING_KEYWORDS = [
  "newsletter", "unsubscribe", "marketing", "promotion", "offer",
  "deal", "discount", "sale", "campaign", "subscribe", "update",
  "announcement", "launch", "new feature", "product update", "weekly",
  "monthly digest", "black friday", "limited time", "exclusive",
];

function isMarketingEmail(subject: string, from: string, snippet: string): boolean {
  const text = `${subject} ${from} ${snippet}`.toLowerCase();
  return MARKETING_KEYWORDS.some((kw) => text.includes(kw));
}

export async function pollGmailInbox(agentId: string): Promise<{
  newCount: number;
  notifications: Array<{ title: string; body: string; from: string }>;
}> {
  // Fetch Gmail connector config for this agent
  const [connector] = await db
    .select()
    .from(agentConnectors)
    .where(
      and(
        eq(agentConnectors.agentId, agentId),
        eq(agentConnectors.connectorType, "gmail"),
        eq(agentConnectors.status, "connected")
      )
    );

  if (!connector) {
    return { newCount: 0, notifications: [] };
  }

  const config = connector.config as Record<string, string> | null;
  if (!config) return { newCount: 0, notifications: [] };

  const { userEmail, appPassword, clientId, clientSecret } = config;
  const accessToken = connector.accessToken;

  // ── Strategy 1: Use stored OAuth access token (full Gmail API) ──────────────
  if (accessToken) {
    return pollWithAccessToken(agentId, accessToken, config);
  }

  // ── Strategy 2: Use clientId + clientSecret for OAuth2 client ───────────────
  if (clientId && clientSecret && userEmail) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    if (connector.refreshToken) {
      oauth2Client.setCredentials({
        refresh_token: connector.refreshToken,
      });
      try {
        const { token } = await oauth2Client.getAccessToken();
        if (token) {
          return pollWithAccessToken(agentId, token, config);
        }
      } catch {
        // fall through
      }
    }
  }

  // ── Strategy 3: App Password → use Gmail API with basic auth (not supported) ─
  // Gmail REST API doesn't support basic auth; inform the user
  return {
    newCount: 0,
    notifications: [
      {
        title: "Gmail inbox monitoring requires OAuth",
        body: "To monitor your inbox for marketing emails, please complete the Gmail OAuth authorization flow. App Password can only be used for sending emails.",
        from: "System",
      },
    ],
  };
}

async function pollWithAccessToken(
  agentId: string,
  accessToken: string,
  config: Record<string, string>
): Promise<{
  newCount: number;
  notifications: Array<{ title: string; body: string; from: string }>;
}> {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get messages from last 24 hours
    const cutoff = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: `after:${cutoff} is:unread`,
      maxResults: 20,
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) return { newCount: 0, notifications: [] };

    const newNotifications: Array<{ title: string; body: string; from: string }> = [];

    for (const msg of messages.slice(0, 10)) {
      if (!msg.id) continue;

      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });

      const headers = detail.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
      const from = headers.find((h) => h.name === "From")?.value || "Unknown";
      const snippet = detail.data.snippet || "";

      if (!isMarketingEmail(subject, from, snippet)) continue;

      // Check if we already stored this notification (avoid duplicates)
      const existing = await db
        .select()
        .from(agentNotifications)
        .where(
          and(
            eq(agentNotifications.agentId, agentId),
            eq(agentNotifications.title, subject)
          )
        );

      if (existing.length > 0) continue;

      // Save notification
      await db.insert(agentNotifications).values({
        agentId,
        type: "email",
        title: subject,
        body: snippet,
        source: "Gmail",
        metadata: { from, messageId: msg.id, subject },
      });

      newNotifications.push({ title: subject, body: snippet, from });
    }

    return { newCount: newNotifications.length, notifications: newNotifications };
  } catch (err: any) {
    console.error("Gmail polling error:", err?.message || err);
    return { newCount: 0, notifications: [] };
  }
}
