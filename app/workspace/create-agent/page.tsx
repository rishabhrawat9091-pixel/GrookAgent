"use client"

import { FormEvent, useState, useRef } from "react"
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  Database,
  FileText,
  HelpCircle,
  Layers,
  Lightbulb,
  Plus,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import axios from "axios"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAgents } from "@/context/AgentContext"

// Pre-built bot avatars
const botDesigns = [
  "market-scout",
  "research-orbit",
  "studio-spark",
  "signal-guide",
  "growth-pilot",
  "cyber-helper",
  "doc-wizard",
  "stellar-mind",
]

const botImage = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff,fef3c7&radius=50`

// Pre-built role templates for non-coders
type RolePreset = {
  id: string
  title: string
  icon: string
  tagline: string
  defaultName: string
  instructions: string
  sampleQuestion: string
}

const rolePresets: RolePreset[] = [
  {
    id: "support",
    title: "Customer Support",
    icon: "🎧",
    tagline: "Friendly, helpful support for troubleshooting and policy questions.",
    defaultName: "Support Hero",
    instructions:
      "You are a warm, empathetic customer support specialist. Your goal is to help users resolve issues quickly and politely. Always maintain a kind and encouraging tone. If you are referencing company policies or guides from the knowledge base, explain them clearly in simple terms. If you don't know the answer, politely offer to connect them with a human supervisor.",
    sampleQuestion: "How do I request a refund or track my order?",
  },
  {
    id: "knowledge",
    title: "Document & FAQ Guru",
    icon: "📚",
    tagline: "Answers questions strictly grounded in your uploaded documents and manuals.",
    defaultName: "Knowledge Scout",
    instructions:
      "You are an intelligent knowledge base assistant. Answer all user questions strictly based on the provided documents and vector database context. Cite the specific document name or section whenever possible. If the requested information is not found in the uploaded documents, state clearly: 'I don't have that information in my knowledge base' and do not fabricate answers.",
    sampleQuestion: "What does section 3 of our employee handbook say about leave?",
  },
  {
    id: "sales",
    title: "Sales & Product Advisor",
    icon: "💼",
    tagline: "Welcomes leads, explains product benefits, and guides purchasing decisions.",
    defaultName: "Sales Spark",
    instructions:
      "You are a proactive and enthusiastic sales consultant. You help prospective customers understand product features, compare pricing packages, and highlight key value propositions. Ask thoughtful qualifying questions to understand the customer's needs and recommend the ideal solution with a confident and professional voice.",
    sampleQuestion: "Which plan is best for a team of 15 people?",
  },
  {
    id: "assistant",
    title: "General Work Assistant",
    icon: "🚀",
    tagline: "Summarizes notes, writes professional emails, and keeps tasks organized.",
    defaultName: "Orbit Assistant",
    instructions:
      "You are a versatile, highly organized workplace assistant. You assist with drafting clear emails, summarizing long documents, creating structured task checklists, and answering team questions concisely and accurately.",
    sampleQuestion: "Can you summarize these meeting notes into action items?",
  },
  {
    id: "custom",
    title: "Custom Bot",
    icon: "⚡",
    tagline: "Start from scratch and build your own unique assistant.",
    defaultName: "My Custom Bot",
    instructions:
      "You are a helpful, smart AI assistant. Follow user instructions carefully and provide insightful, accurate, and concise answers.",
    sampleQuestion: "How can I help you today?",
  },
]

type FileItem = {
  file: File
  name: string
  size: string
}

export default function CreateAgentPage() {
  const router = useRouter()
  const { refreshAgents } = useAgents()

  // Bot Identity state
  const [name, setName] = useState("Support Hero")
  const [designIndex, setDesignIndex] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<string>("support")

  // Instructions state
  const [instructionMode, setInstructionMode] = useState<"guided" | "direct">("guided")
  const [guidedJob, setGuidedJob] = useState("Help customers solve issues and answer policy questions.")
  const [guidedTone, setGuidedTone] = useState("Friendly, warm, and empathetic")
  const [guidedRules, setGuidedRules] = useState(
    "Always be polite. Use simple language. Only answer from uploaded knowledge when possible."
  )
  const [instructions, setInstructions] = useState(rolePresets[0].instructions)

  // Vector Knowledge Base state
  const [knowledgeTab, setKnowledgeTab] = useState<"files" | "text">("files")
  const [files, setFiles] = useState<FileItem[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pasted text knowledge
  const [textTitle, setTextTitle] = useState("")
  const [textContent, setTextContent] = useState("")

  // Submission & Progress state
  const [isSaving, setIsSaving] = useState(false)
  const [progressStep, setProgressStep] = useState<string>("")
  const [error, setError] = useState("")

  const image = botImage(botDesigns[designIndex])

  // Select a pre-built preset
  const handleSelectPreset = (preset: RolePreset) => {
    setSelectedPreset(preset.id)
    setName(preset.defaultName)
    setInstructions(preset.instructions)
    if (preset.id === "support") {
      setGuidedJob("Help customers solve problems and guide them through our services.")
      setGuidedTone("Friendly, warm, and polite")
      setGuidedRules("Always maintain a helpful attitude. Reference company policies clearly.")
    } else if (preset.id === "knowledge") {
      setGuidedJob("Answer user queries strictly based on our uploaded company manuals.")
      setGuidedTone("Professional, precise, and factual")
      setGuidedRules("Always cite the source document. Do not guess or make up facts.")
    } else if (preset.id === "sales") {
      setGuidedJob("Present our products, answer pricing inquiries, and gather customer requirements.")
      setGuidedTone("Energetic, confident, and professional")
      setGuidedRules("Highlight customer benefits. Ask clarifying questions.")
    } else {
      setGuidedJob("Assist the team with tasks, summaries, and answering inquiries.")
      setGuidedTone("Organized, clear, and proactive")
      setGuidedRules("Keep replies concise and easy to read.")
    }
  }

  // Generate instructions from guided questions
  const applyGuidedInstructions = () => {
    const compiled = `You are ${name.trim() || "an AI Assistant"}.
Main Responsibility: ${guidedJob.trim()}
Communication Tone: ${guidedTone.trim()}
Guiding Rules & Boundaries:
- ${guidedRules.trim().replace(/\n/g, "\n- ")}
- When relevant knowledge is available in the vector database, prioritize and cite those facts accurately.`

    setInstructions(compiled)
    setInstructionMode("direct")
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Handle file additions
  const handleAddFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    const validFiles: FileItem[] = []
    Array.from(newFiles).forEach((f) => {
      validFiles.push({
        file: f,
        name: f.name,
        size: formatSize(f.size),
      })
    })
    setFiles((prev) => [...prev, ...validFiles])
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit and create bot + upload vector knowledge
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Please provide a name for your bot.")
      return
    }

    const finalInstructions =
      instructionMode === "guided"
        ? `You are ${name.trim()}.
Main Goal: ${guidedJob.trim()}
Tone: ${guidedTone.trim()}
Rules: ${guidedRules.trim()}`
        : instructions.trim()

    if (!finalInstructions) {
      setError("Please add some instructions for how your bot should behave.")
      return
    }

    setIsSaving(true)
    setError("")
    const agentId = crypto.randomUUID()

    try {
      // Step 1: Create bot in database
      setProgressStep("1/3: Creating bot persona and setting instructions...")
      await axios.post("/api/agent", {
        agentId,
        name: name.trim(),
        description: finalInstructions,
        agentImage: image,
      })

      // Step 2: Upload and index vector documents if any
      const hasFiles = files.length > 0
      const hasPastedText = textContent.trim().length > 0

      if (hasFiles || hasPastedText) {
        setProgressStep("2/3: Generating embeddings and indexing into Vector Database (Pinecone)...")

        // Upload attached files
        for (const item of files) {
          const formData = new FormData()
          formData.append("file", item.file)
          formData.append("agentId", agentId)
          try {
            await axios.post("/api/documentprocess", formData)
          } catch (docErr) {
            console.warn(`Vector index warning for ${item.name}:`, docErr)
          }
        }

        // Upload pasted text note if provided
        if (hasPastedText) {
          const textFormData = new FormData()
          textFormData.append("text", textContent.trim())
          textFormData.append("title", textTitle.trim() || "Initial Knowledge Notes")
          textFormData.append("agentId", agentId)
          try {
            await axios.post("/api/documentprocess", textFormData)
          } catch (textErr) {
            console.warn("Vector index warning for pasted text:", textErr)
          }
        }
      }

      // Step 3: Refresh and navigate
      setProgressStep("3/3: Finalizing bot workspace...")
      await refreshAgents()
      router.push(`/workspace/agent/${agentId}`)
    } catch (err: any) {
      console.error("Agent creation failed:", err)
      setError(err?.response?.data?.message || "Failed to create your bot. Please try again.")
      setIsSaving(false)
      setProgressStep("")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/workspace")}
            className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            title="Back to workspace"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200">
                No-Code Bot Builder
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">Vector DB Grounded</span>
            </div>
            <h1 className="text-base font-bold text-slate-900">Create New AI Assistant</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/workspace")}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm transition"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="size-4 animate-spin" />
                Building Bot...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Launch Bot
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button onClick={() => setError("")} className="font-semibold text-rose-600 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Progress Overlay during creation */}
        {isSaving && (
          <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50/80 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <RefreshCw className="size-5 animate-spin text-teal-600" />
              <div>
                <p className="text-sm font-semibold text-teal-900">Building and Indexing Your Bot</p>
                <p className="text-xs text-teal-700">{progressStep || "Processing..."}</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-teal-200">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-teal-600 transition-all duration-500" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1: BOT PERSONA & IDENTITY */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-600">
                  Step 1 • Identity
                </span>
                <h2 className="text-lg font-bold text-slate-900">Name & Appearance</h2>
                <p className="text-xs text-slate-500">Choose who this assistant is and what role it fills.</p>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="size-14 border-2 border-slate-100 shadow-sm" size="lg">
                  <AvatarImage src={image} alt="Bot Avatar" />
                  <AvatarFallback className="bg-slate-100 text-slate-600">
                    <Bot className="size-6" />
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => setDesignIndex((idx) => (idx + 1) % botDesigns.length)}
                  className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  title="Shuffle bot avatar"
                >
                  <Shuffle className="size-4" />
                </button>
              </div>
            </div>

            {/* Quick Templates Selector */}
            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Choose a Starting Persona (1-Click)
              </label>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {rolePresets.map((preset) => {
                  const isCurrent = selectedPreset === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                        isCurrent
                          ? "border-teal-500 bg-teal-50/50 shadow-xs ring-1 ring-teal-500"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xl">{preset.icon}</span>
                        {isCurrent && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-teal-600 text-white">
                            <Check className="size-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <span className="mt-2 text-sm font-semibold text-slate-900">{preset.title}</span>
                      <span className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {preset.tagline}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bot Name Input */}
            <div className="mt-6">
              <label htmlFor="bot-name" className="block text-sm font-semibold text-slate-700">
                Bot Name
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="bot-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Support Hero, Scout, Product Guide"
                  required
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: BOT INSTRUCTIONS (NON-CODER WIZARD) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-600">
                  Step 2 • Instructions
                </span>
                <h2 className="text-lg font-bold text-slate-900">How Should Your Bot Act?</h2>
                <p className="text-xs text-slate-500">
                  No coding needed. Answer a few simple questions or write in plain English.
                </p>
              </div>

              {/* Mode switch */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setInstructionMode("guided")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    instructionMode === "guided"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Wand2 className="size-3.5 text-teal-600" />
                  Guided Wizard
                </button>
                <button
                  type="button"
                  onClick={() => setInstructionMode("direct")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    instructionMode === "direct"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="size-3.5" />
                  Custom Prompt
                </button>
              </div>
            </div>

            {instructionMode === "guided" ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    1. What is this bot's primary job?
                  </label>
                  <input
                    type="text"
                    value={guidedJob}
                    onChange={(e) => setGuidedJob(e.target.value)}
                    placeholder="e.g. Answer customer questions about pricing and product return policies"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    2. What tone of voice should it use?
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {[
                      "Friendly, warm, and helpful",
                      "Professional, crisp, and direct",
                      "Casual, energetic, and fun",
                      "Executive, concise, and structured",
                    ].map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => setGuidedTone(tone)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          guidedTone === tone
                            ? "border-teal-500 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={guidedTone}
                    onChange={(e) => setGuidedTone(e.target.value)}
                    placeholder="Or type a custom tone..."
                    className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-xs text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    3. What rules or boundaries should it follow?
                  </label>
                  <textarea
                    rows={2}
                    value={guidedRules}
                    onChange={(e) => setGuidedRules(e.target.value)}
                    placeholder="e.g. Never give medical advice. Keep answers under 3 paragraphs. Only use uploaded documents."
                    className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span className="text-xs text-slate-500">
                    Want to preview or refine the exact prompt text?
                  </span>
                  <button
                    type="button"
                    onClick={applyGuidedInstructions}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
                  >
                    <Sparkles className="size-3.5" />
                    Compile into Custom Prompt
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="custom-instructions" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Bot Instructions (Plain English)
                  </label>
                  <span className="text-xs text-slate-400">
                    {instructions.length} characters
                  </span>
                </div>
                <textarea
                  id="custom-instructions"
                  rows={6}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Tell your bot what to do, what tone to adopt, and how to respond..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Add rule:</span>
                  {[
                    "Only answer from uploaded documents",
                    "Keep answers concise and clear",
                    "If unsure, ask for clarification",
                  ].map((rule) => (
                    <button
                      key={rule}
                      type="button"
                      onClick={() => setInstructions((prev) => `${prev.trim()}\n- ${rule}`)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 transition"
                    >
                      + {rule}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: VECTOR DATABASE & KNOWLEDGE BASE */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-600">
                    Step 3 • Vector Database
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                    Pinecone Connected
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">Add Knowledge to Vector DB</h2>
                <p className="text-xs text-slate-500">
                  Attach your files or paste FAQs. We automatically turn them into vector embeddings so your bot knows your content.
                </p>
              </div>

              {/* Sub-tab: Upload File vs Paste Text */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setKnowledgeTab("files")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    knowledgeTab === "files"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <UploadCloud className="size-3.5" />
                  Upload Files
                </button>
                <button
                  type="button"
                  onClick={() => setKnowledgeTab("text")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                    knowledgeTab === "text"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <BrainCircuit className="size-3.5" />
                  Paste Text / Notes
                </button>
              </div>
            </div>

            {/* Knowledge Tab Content */}
            {knowledgeTab === "files" ? (
              <div className="mt-5 space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDraggingOver(true)
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDraggingOver(false)
                    handleAddFiles(e.dataTransfer.files)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                    isDraggingOver
                      ? "border-teal-500 bg-teal-50/60"
                      : "border-slate-300 hover:border-teal-400 hover:bg-slate-50/70"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.csv,.doc,.docx"
                    className="hidden"
                    onChange={(e) => handleAddFiles(e.target.files)}
                  />
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-100">
                    <UploadCloud className="size-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    Click to browse or drag & drop documents here
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Supports PDF, TXT, Markdown, CSV, and DOC files
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                    <Database className="size-3" />
                    Automatically chunked & stored in Pinecone Vector Database
                  </div>
                </div>

                {/* Selected Files List */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span>Documents to be Indexed ({files.length})</span>
                      <button
                        type="button"
                        onClick={() => setFiles([])}
                        className="text-rose-600 hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {files.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="size-4 shrink-0 text-teal-600" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{item.name}</p>
                              <p className="text-[11px] text-slate-400">{item.size} • Ready for Vector Index</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-rose-600 transition"
                            title="Remove file"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="text-title" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Knowledge Title / Topic
                  </label>
                  <input
                    id="text-title"
                    type="text"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="e.g. Return Policy, Office Hours, Product FAQ"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label htmlFor="text-content" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Paste Content or Notes
                  </label>
                  <textarea
                    id="text-content"
                    rows={5}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Paste company info, FAQ questions and answers, or instructions here. We'll index it straight into vector storage."
                    className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    {textContent.trim().length > 0 ? (
                      <span className="text-teal-700 font-medium">
                        ✓ {textContent.trim().length} characters ready to be converted into vector embeddings
                      </span>
                    ) : (
                      "You can also leave this blank and add documents later from the bot's configuration panel."
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SUMMARY & SUBMISSION BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 border border-slate-200">
                <AvatarImage src={image} />
                <AvatarFallback>
                  <Bot className="size-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-slate-900">{name || "Untitled Bot"}</p>
                <p className="text-xs text-slate-500">
                  {files.length > 0 || textContent.trim()
                    ? `Ready with ${files.length} document(s) for Vector DB`
                    : "Ready without initial documents"}
                </p>
              </div>
            </div>

            <div className="flex w-full sm:w-auto items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/workspace")}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="h-11 bg-teal-600 hover:bg-teal-700 text-white px-6 font-semibold shadow-sm transition"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="size-4 animate-spin" />
                    Creating Bot...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4" />
                    Create Bot & Connect Vector DB
                  </span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
