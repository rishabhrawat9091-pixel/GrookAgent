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
  password: text("password"),
  role: text("role").default("employee").notNull(), // 'admin' | 'employee'
  department: text("department").default("General"),
  salary: integer("salary").default(0),
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

// ─── Bot Chat History ────────────────────────────────────────────────────────
export const agentChats = pgTable("agent_chats", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: text("agent_id").notNull(),
  userEmail: text("user_email").notNull(),
  sender: text("sender").notNull(), // 'user' | 'agent'
  text: text("text").notNull(),
  toolsExecuted: jsonb("tools_executed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Bot Vector Knowledge Documents ─────────────────────────────────────────
export const agentDocuments = pgTable("agent_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: text("agent_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").default("pdf"),
  chunksCount: integer("chunks_count").default(0),
  status: text("status").default("indexed").notNull(),
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

export type AgentChat = typeof agentChats.$inferSelect;
export type NewAgentChat = typeof agentChats.$inferInsert;

export type AgentDocument = typeof agentDocuments.$inferSelect;
export type NewAgentDocument = typeof agentDocuments.$inferInsert;