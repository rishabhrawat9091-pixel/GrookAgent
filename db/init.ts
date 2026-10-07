import postgres from 'postgres';

let isInitialized = false;

export async function ensureDatabaseTables() {
  if (isInitialized) return;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('placeholder-url')) return;

  const sql = postgres(databaseUrl, { prepare: false, max: 1 });

  try {
    // Ensure agent_chats table exists for persistent bot conversation
    await sql`
      CREATE TABLE IF NOT EXISTS agent_chats (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id text NOT NULL,
        user_email text NOT NULL,
        sender text NOT NULL,
        text text NOT NULL,
        tools_executed jsonb,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `;

    // Ensure agent_documents table exists for vector database tracking
    await sql`
      CREATE TABLE IF NOT EXISTS agent_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id text NOT NULL,
        file_name text NOT NULL,
        file_type text DEFAULT 'pdf',
        chunks_count integer DEFAULT 0,
        status text DEFAULT 'indexed' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `;

    isInitialized = true;
  } catch (error) {
    console.warn("ensureDatabaseTables warning (will retry on next request):", error);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
