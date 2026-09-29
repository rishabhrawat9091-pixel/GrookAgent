import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { uuid } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  credits: integer('credits').default(5)
});

export const agents = pgTable("agent", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  instructions: text("instructions").notNull(),
  agentImage: text("agent_image").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userEmail: text("user_email").notNull(),
});


export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

