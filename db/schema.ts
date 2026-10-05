import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uuid,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  credits: integer("credits").default(5),
});

export const agents = pgTable("agent", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  instructions: text("instructions").notNull(),
  agentImage: text("agent_image").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userEmail: text("user_email").notNull(),
});

export const agentConnectors = pgTable(
  "agent_connector",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, {
        onDelete: "cascade",
      }),

    connectorType: text("connector_type").notNull(),

    status: text("status").notNull().default("disconnected"),

    clientId: text("client_id"),

    clientSecret: text("client_secret"),

    userEmail: text("user_email"),

    scope: text("scope"),

    accessToken: text("access_token"),

    refreshToken: text("refresh_token"),

    tokenExpiresAt: timestamp("token_expires_at"),

    config: jsonb("config"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agentConnectorUnique: uniqueIndex(
      "agent_connector_agent_type_unique"
    ).on(table.agentId, table.connectorType),
  })
);

// ─── Inbox notifications (marketing email alerts, etc.) ─────────────────────
export const agentNotifications = pgTable("agent_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),

  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),

  type: text("type").notNull().default("email"), // "email" | "slack" | "generic"

  title: text("title").notNull(),

  body: text("body"),

  source: text("source"), // e.g. "Gmail", "Slack"

  isRead: text("is_read").notNull().default("false"),

  metadata: jsonb("metadata"), // raw data (from, subject, snippet, etc.)

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type AgentConnector = typeof agentConnectors.$inferSelect;
export type NewAgentConnector = typeof agentConnectors.$inferInsert;

export type AgentNotification = typeof agentNotifications.$inferSelect;
export type NewAgentNotification = typeof agentNotifications.$inferInsert;