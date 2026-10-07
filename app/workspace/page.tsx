"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Bot, ArrowRight, Sparkles, Plus, MessageSquare, Headphones, BookOpen, Briefcase, Zap } from "lucide-react"
import { useAgents } from "@/context/AgentContext"
import axios from "axios"

const PREBUILT_BOTS = [
  {
    id: "support",
    name: "Support Hero",
    icon: Headphones,
    color: "from-blue-500 to-cyan-500",
    bgLight: "bg-blue-50/70 border-blue-100",
    textCol: "text-blue-700",
    tagline: "Customer Support & Troubleshooting",
    description: "Welcomes users, diagnoses technical issues, answers policy queries, and guides resolutions.",
    instructions:
      "You are a warm, empathetic customer support specialist. Your goal is to help users resolve issues quickly and politely. Always maintain a kind and encouraging tone. If you are referencing company policies or guides from the knowledge base, explain them clearly in simple terms. If you don't know the answer, politely offer to connect them with a human supervisor.",
    avatar: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=market-scout&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff,fef3c7&radius=50",
  },
  {
    id: "knowledge",
    name: "Knowledge Scout",
    icon: BookOpen,
    color: "from-emerald-500 to-teal-500",
    bgLight: "bg-emerald-50/70 border-emerald-100",
    textCol: "text-emerald-700",
    tagline: "Document & FAQ Guru",
    description: "Strictly grounded in your uploaded documents, PDFs, and handbooks with zero hallucinations.",
    instructions:
      "You are an intelligent knowledge base assistant. Answer all user questions strictly based on the provided documents and vector database context. Cite the specific document name or section whenever possible. If the requested information is not found in the uploaded documents, state clearly: 'I don't have that information in my knowledge base' and do not fabricate answers.",
    avatar: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=doc-wizard&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff,fef3c7&radius=50",
  },
  {
    id: "sales",
    name: "Sales Spark",
    icon: Briefcase,
    color: "from-purple-500 to-indigo-500",
    bgLight: "bg-purple-50/70 border-purple-100",
    textCol: "text-purple-700",
    tagline: "Sales & Product Advisor",
    description: "Explains features, calculates plan pricing, qualifies customer needs, and accelerates deals.",
    instructions:
      "You are a proactive and enthusiastic sales consultant. You help prospective customers understand product features, compare pricing packages, and highlight key value propositions. Ask thoughtful qualifying questions to understand the customer's needs and recommend the ideal solution with a confident and professional voice.",
    avatar: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=growth-pilot&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff,fef3c7&radius=50",
  },
  {
    id: "assistant",
    name: "Orbit Assistant",
    icon: Zap,
    color: "from-amber-500 to-orange-500",
    bgLight: "bg-amber-50/70 border-amber-100",
    textCol: "text-amber-700",
    tagline: "General Work & Productivity",
    description: "Drafts emails, condenses meeting notes, structures action checklists, and streamlines work.",
    instructions:
      "You are a versatile, highly organized workplace assistant. You assist with drafting clear emails, summarizing long documents, creating structured task checklists, and answering team questions concisely and accurately.",
    avatar: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=studio-spark&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff,fef3c7&radius=50",
  },
]

export default function WorkspacePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { agents, refreshAgents } = useAgents()
  const [openingBotId, setOpeningBotId] = useState<string | null>(null)

  const userName = session?.user?.name || (session?.user?.email ? session.user.email.split("@")[0] : "there")

  const handleOpenPrebuilt = async (preset: (typeof PREBUILT_BOTS)[0]) => {
    // Check if user already has this bot created
    const existing = agents.find((a) => a.name.toLowerCase() === preset.name.toLowerCase())
    if (existing) {
      router.push(`/workspace/agent/${existing.id}`)
      return
    }

    setOpeningBotId(preset.id)
    try {
      const agentId = crypto.randomUUID()
      await axios.post("/api/agent", {
        agentId,
        name: preset.name,
        description: preset.instructions,
        agentImage: preset.avatar,
      })
      await refreshAgents()
      router.push(`/workspace/agent/${agentId}`)
    } catch (err) {
      console.error("Failed to provision prebuilt bot:", err)
      setOpeningBotId(null)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50/60 text-zinc-900">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200/90 bg-white px-6">
        <div>
          <h1 className="text-sm sm:text-base font-semibold text-zinc-900">
            Welcome back, {userName} 👋
          </h1>
          <p className="text-xs text-zinc-500">
            Open any prebuilt bot to automatically start an introductory chat.
          </p>
        </div>

        <button
          onClick={() => router.push("/workspace/create-agent")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-zinc-800"
        >
          <Plus className="size-3.5" />
          <span>New Custom Bot</span>
        </button>
      </header>

      {/* Main Content Area */}
      <section className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 max-w-6xl mx-auto w-full space-y-8">
        {/* Your Active Bots Banner (if any) */}
        {agents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Your Active Bots ({agents.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => router.push(`/workspace/agent/${agent.id}`)}
                  className="group flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs transition hover:border-teal-500 hover:shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={agent.agentImage || "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=default"}
                      alt={agent.name}
                      className="size-10 rounded-full border border-zinc-200/80 bg-zinc-50"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 group-hover:text-teal-700">
                        {agent.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {agent.instructions?.slice(0, 60) || "Ready for chat"}...
                      </p>
                    </div>
                  </div>
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 transition group-hover:bg-teal-50 group-hover:text-teal-700">
                    <MessageSquare className="size-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prebuilt Bots Grid */}
        <div>
          <div className="mb-4">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
              <Sparkles className="size-3" />
              <span>Pre-Built Interactive Bots</span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
              Select a Prebuilt Bot to Start
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              When opened, each prebuilt bot automatically introduces its specialized capabilities and provides tailored starter actions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PREBUILT_BOTS.map((bot) => {
              const Icon = bot.icon
              const isOpening = openingBotId === bot.id
              const alreadyExists = agents.some((a) => a.name.toLowerCase() === bot.name.toLowerCase())

              return (
                <div
                  key={bot.id}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs transition hover:border-zinc-300 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={bot.avatar}
                          alt={bot.name}
                          className="size-12 rounded-xl border border-zinc-100 bg-zinc-50 p-0.5 shadow-2xs"
                        />
                        <div>
                          <h3 className="text-base font-semibold text-zinc-900">
                            {bot.name}
                          </h3>
                          <span className={`inline-block text-xs font-medium ${bot.textCol}`}>
                            {bot.tagline}
                          </span>
                        </div>
                      </div>

                      <div className={`flex size-9 items-center justify-center rounded-xl border ${bot.bgLight}`}>
                        <Icon className={`size-4.5 ${bot.textCol}`} />
                      </div>
                    </div>

                    <p className="mt-3 text-xs sm:text-sm leading-relaxed text-zinc-600">
                      {bot.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-400">
                      {alreadyExists ? "Ready in workspace" : "Auto-introduces on open"}
                    </span>
                    <button
                      type="button"
                      disabled={isOpening}
                      onClick={() => handleOpenPrebuilt(bot)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
                    >
                      <span>{isOpening ? "Opening..." : alreadyExists ? "Open Chat" : "Launch & Chat"}</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
