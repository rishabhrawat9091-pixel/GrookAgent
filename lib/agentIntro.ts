export type IntroResult = {
  text: string
  prompts: string[]
}

type AgentLike = {
  name?: string | null
  instructions?: string | null
  agentImage?: string | null
}

/**
 * Intelligently generates the introductory first chat message for an agent/bot,
 * introducing its identity, capabilities, instructions, and connected tools to the user.
 */
export function generateAgentIntro(
  agent?: AgentLike | null,
  connectors: string[] = []
): IntroResult {
  const name = (agent?.name || "Assistant").trim()
  const instructions = (agent?.instructions || "").toLowerCase()
  const rawInstructions = agent?.instructions || ""

  // Connector capabilities bullet points
  const connectorNotes: string[] = []
  if (connectors.includes("gmail")) {
    connectorNotes.push("📧 **Gmail Integration**: Can draft and send emails on your behalf.")
  }
  if (connectors.includes("slack")) {
    connectorNotes.push("💬 **Slack Integration**: Can post real-time updates directly to your team channels.")
  }
  if (connectors.includes("web")) {
    connectorNotes.push("🌐 **Web Search**: Can browse and retrieve up-to-date web intelligence.")
  }

  const connectorText =
    connectorNotes.length > 0
      ? `\n\n### 🔌 Connected Integrations\n${connectorNotes.join("\n")}`
      : ""

  // ── 1. Customer Support Bot (e.g. Support Hero) ──
  if (
    name.toLowerCase().includes("support") ||
    instructions.includes("customer support") ||
    instructions.includes("troubleshoot") ||
    instructions.includes("refund")
  ) {
    return {
      text: `👋 **Hello! I'm ${name}**, your dedicated Customer Support Specialist.

I'm here to ensure you and your customers get quick, polite, and effective answers. Here is what I can do for you:

• 🛠️ **Troubleshoot Issues**: Diagnose technical blockers, bugs, or workflow issues step-by-step.
• 📋 **Policies & Guidelines**: Answer questions about company policies, return procedures, and terms in simple English.
• 🤝 **Escalations & Summaries**: Prepare structured issue summaries whenever human supervisor review is needed.
• ⚡ **Knowledge Base Integration**: Reference verified manuals and FAQs to provide accurate guidance.${connectorText}

How can I help you today? Choose a prompt below or type your question!`,
      prompts: [
        "How do I request a refund or track my order?",
        "Help me troubleshoot a technical issue",
        "What are our support hours and policies?",
        "Summarize an issue for escalation",
      ],
    }
  }

  // ── 2. Document & FAQ Guru (e.g. Knowledge Scout) ──
  if (
    name.toLowerCase().includes("knowledge") ||
    name.toLowerCase().includes("document") ||
    name.toLowerCase().includes("guru") ||
    instructions.includes("vector") ||
    instructions.includes("handbook") ||
    instructions.includes("manual") ||
    instructions.includes("strictly based on the provided documents")
  ) {
    return {
      text: `👋 **Hello! I'm ${name}**, your Document & Knowledge Base Assistant.

I am connected to your vector knowledge base to deliver answers strictly grounded in your uploaded documents and manuals. Here is what I can do:

• 📖 **Document Retrieval**: Instant answers from your PDFs, handbooks, SOPs, and spreadsheets.
• 🔍 **Direct Citations**: Pinpoint the exact sections, clauses, or document names for complete transparency.
• 🎯 **Zero-Hallucination Mode**: If information isn't in your uploaded files, I will clearly let you know rather than guessing.${connectorText}

What document or topic would you like to search or ask about?`,
      prompts: [
        "What does section 3 of our employee handbook say about leave?",
        "Summarize our latest uploaded document",
        "What are the company guidelines on expenses?",
        "Search knowledge base for onboarding steps",
      ],
    }
  }

  // ── 3. Sales & Product Advisor (e.g. Sales Spark) ──
  if (
    name.toLowerCase().includes("sales") ||
    instructions.includes("sales") ||
    instructions.includes("purchasing decisions") ||
    instructions.includes("pricing") ||
    instructions.includes("product advisor")
  ) {
    return {
      text: `👋 **Hello! I'm ${name}**, your Sales & Product Advisor.

I'm here to help prospective customers and team members explore product capabilities, calculate value, and choose the best fit. Here is what I can do:

• 💼 **Product Consultation**: Explain key features, benefits, and architectural highlights.
• 💰 **Plan & Tier Comparison**: Break down pricing options, feature tiers, and team seat requirements.
• 🎯 **Customer Qualification**: Ask thoughtful questions to understand unique goals and tailor recommendations.${connectorText}

Tell me a bit about what you're looking for or pick an inquiry below!`,
      prompts: [
        "Which plan is best for a team of 15 people?",
        "What are the key benefits and features?",
        "Compare Pro and Enterprise pricing",
        "How do we migrate from our existing tool?",
      ],
    }
  }

  // ── 4. General Workplace Assistant (e.g. Orbit Assistant) ──
  if (
    name.toLowerCase().includes("assistant") ||
    instructions.includes("versatile") ||
    instructions.includes("summarize notes") ||
    instructions.includes("workplace assistant")
  ) {
    return {
      text: `👋 **Hello! I'm ${name}**, your versatile Workplace Productivity Assistant.

I'm ready to help you save time, organize projects, and communicate effectively. Here is what I can do:

• ✉️ **Drafting & Writing**: Compose polished emails, memos, announcements, and executive summaries.
• 📝 **Summarization**: Turn meeting notes, research, and long briefs into clear takeaways.
• ✅ **Task Management**: Structure action items, project checklists, and weekly priorities.${connectorText}

What would you like to work on together today?`,
      prompts: [
        "Can you summarize these meeting notes into action items?",
        "Draft a professional project update email",
        "Help me plan my priorities for this week",
        "Create an agenda for our team sync",
      ],
    }
  }

  // ── 5. Security Bot ──
  if (
    name.toLowerCase().includes("security") ||
    instructions.includes("security") ||
    instructions.includes("compliance") ||
    instructions.includes("audit")
  ) {
    return {
      text: `🔒 **Greetings. I am ${name}**, your Security & Access Provisioning Bot.

I have direct executive authority to manage security, access control, and credentials for this platform. Here is what I can do:

• 👥 **User Directory & Audit**: List all registered employees and administrators, inspect roles, departments, and account details from the database.
• 🔑 **Credential Generation**: Provision new employee login credentials (email + secure temporary password) and sync them to the database instantly.
• 🛡️ **Role Management**: Promote or demote users between admin and employee roles with immediate effect.
• ⚙️ **Bot Configuration** (Admin Only): View or update the current bot's name, instructions, and behavior settings.
• 📋 **Integration Security**: Verify connected integrations (Gmail SMTP, Slack, Web) and their authentication status.${connectorText}

State your request to begin. Only administrators have permission for role changes and bot configuration updates.`,
      prompts: [
        "List all registered employees in the database",
        "Generate login credentials for a new employee",
        "Change a user's role to admin",
        "Show current bot configuration",
      ],
    }
  }

  // ── 6. Dynamic / Custom Bot ──
  // Extract summary from custom instructions if present
  let customDetails = ""
  if (rawInstructions.trim()) {
    const cleanLines = rawInstructions
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.toLowerCase().startsWith("you are"))
      .slice(0, 3)

    if (cleanLines.length > 0) {
      customDetails = cleanLines.map((l) => `• ${l.replace(/^[-*•]\s*/, "")}`).join("\n")
    }
  }

  return {
    text: `👋 **Hello! I'm ${name}**.

I am configured and ready to assist you. Here is an overview of what I am set up to do:

${customDetails || `• 💡 **AI Guidance**: Answer questions and provide assistance based on my instructions.\n• ⚡ **Productivity**: Help you draft content, research topics, and solve problems.`}${connectorText}

Feel free to ask me anything or choose one of the options below to get started!`,
    prompts: [
      `What can you help me with?`,
      `Give me a quick summary of your capabilities`,
      `How do I best interact with you?`,
    ],
  }
}
