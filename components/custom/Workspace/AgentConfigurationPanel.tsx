"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import axios from "axios"
import {
  Bot,
  CalendarClock,
  Check,
  Database,
  FileText,
  Lock,
  SlidersHorizontal,
  Shuffle,
  Upload,
  UserRoundCog,
  Wrench,
  X,
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Agent, useAgents } from "@/context/AgentContext"
import {
  CONNECTORS,
  ConnectorConfig,
  ConnectorCredentialModal,
  ConnectorId,
} from "./ConnectorCredentialModal"

export type Panel = "profile" | "tools" | "schedule" | "knowledge"

export type ToolSettings = {
  gmail: boolean
  telegram: boolean
}

type AgentConfigurationPanelProps = {
  agent: Agent | null
  onChange?: (changes: Partial<Agent>) => void
  onSaved?: (agent: Agent) => void
  onClose?: () => void
}

const panels: {
  id: Panel
  label: string
  icon: typeof UserRoundCog
}[] = [
    {
      id: "profile",
      label: "Profile",
      icon: UserRoundCog,
    },
    {
      id: "tools",
      label: "Connected tools",
      icon: Wrench,
    },
    {
      id: "schedule",
      label: "Schedule",
      icon: CalendarClock,
    },
    {
      id: "knowledge",
      label: "Knowledge",
      icon: Database,
    },
  ]

const avatarSeeds = [
  "aster-field",
  "milo-lab",
  "sol-coach",
  "juniper-plan",
  "piper-ops",
]

const avatarUrlFor = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}&backgroundColor=fef3c7,dbeafe,dcfce7,fce7f3,e0f2fe&radius=50`

export function AgentConfigurationPanel({
  agent,
  onChange,
  onSaved,
  onClose,
}: AgentConfigurationPanelProps) {
  const params = useParams()
  const agentId = (params?.agentId as string) || agent?.id || ""

  const router = useRouter()
  const { updateAgent } = useAgents()
  const { data: session } = useSession()

  const isAdmin =
    (session?.user as { role?: string })?.role === "admin"

  const [activePanel, setActivePanel] = useState<Panel>("profile")
  const [avatarIndex, setAvatarIndex] = useState(0)

  const [tools, setTools] = useState<ToolSettings>({
    gmail: false,
    telegram: false,
  })

  const [scheduleEnabled, setScheduleEnabled] = useState(true)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const [selectedConnectorForCreds, setSelectedConnectorForCreds] =
    useState<ConnectorConfig | null>(null)

  const [connectorCredentials, setConnectorCredentials] = useState<
    Record<ConnectorId, Record<string, string>>
  >({
    gmail: {},
    telegram: {},
  })

  useEffect(() => {
    if (!agentId || agentId === "new") return

    const loadConnectors = async () => {
      try {
        const res = await fetch(
          `/api/connector?agentId=${encodeURIComponent(agentId)}`
        )

        if (!res.ok) return

        const data = (await res.json()) as {
          connectors?: Array<{
            connectorType: string
            config?: Record<string, string> | null
          }>
        }

        if (!Array.isArray(data.connectors)) return

        const updatedCreds: Record<
          ConnectorId,
          Record<string, string>
        > = {
          gmail: {},
          telegram: {},
        }

        const updatedTools: ToolSettings = {
          gmail: false,
          telegram: false,
        }

        for (const conn of data.connectors) {
          const type = conn.connectorType as ConnectorId

          if (type in updatedTools) {
            updatedTools[type] = true
            updatedCreds[type] =
              (conn.config as Record<string, string>) ?? {}
          }
        }

        setTools(updatedTools)
        setConnectorCredentials(updatedCreds)
      } catch (err) {
        console.error("Failed to load connectors:", err)
      }
    }

    void loadConnectors()
  }, [agentId])

  const signout = async () => {
    await signOut({
      redirect: false,
      callbackUrl: "/sign-in",
    })

    router.push("/sign-in")
  }
  const handleToggleConnector = (
    conn: ConnectorConfig,
    checked: boolean
  ) => {
    if (checked) {
      setSelectedConnectorForCreds(conn)
    } else {
      setTools((current) => ({
        ...current,
        [conn.id]: false,
      }))
    }
  }

  const handleSaveCredentials = (
    connectorId: ConnectorId,
    creds: Record<string, string>
  ) => {
    setConnectorCredentials((prev) => ({
      ...prev,
      [connectorId]: creds,
    }))

    setTools((current) => ({
      ...current,
      [connectorId]: true,
    }))
  }

  const handleDisconnectConnector = (
    connectorId: ConnectorId
  ) => {
    setConnectorCredentials((prev) => ({
      ...prev,
      [connectorId]: {},
    }))

    setTools((current) => ({
      ...current,
      [connectorId]: false,
    }))
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [knowledgeSubTab, setKnowledgeSubTab] = useState<"files" | "text">("files")
  const [knowledgeTextTitle, setKnowledgeTextTitle] = useState("")
  const [knowledgeTextContent, setKnowledgeTextContent] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const [uploadedDocs, setUploadedDocs] = useState<
    {
      id?: string
      name: string
      uploadedAt: string
      chunksCount?: number
      fileType?: string
    }[]
  >([])

  const [isDraggingOver, setIsDraggingOver] = useState(false)

  useEffect(() => {
    if (!agentId || agentId === "new") return
    const fetchDocs = async () => {
      try {
        const { data } = await axios.get(
          `/api/documentprocess?agentId=${encodeURIComponent(agentId)}`
        )
        if (data?.documents && Array.isArray(data.documents)) {
          setUploadedDocs(
            data.documents.map((d: any) => ({
              id: d.id,
              name: d.fileName,
              uploadedAt: new Date(d.createdAt).toLocaleDateString(),
              chunksCount: d.chunksCount,
              fileType: d.fileType,
            }))
          )
        }
      } catch (err) {
        console.warn("Failed to load documents for agent:", err)
      }
    }
    void fetchDocs()
  }, [agentId])

  const [formdata, Setformdata] = useState({
    name: agent?.name || "",
    agentImage:
      agent?.agentImage || avatarUrlFor(avatarSeeds[0]),
    description: agent?.instructions || "",
  })

  useEffect(() => {
    if (agent) {
      Setformdata({
        name: agent.name || "",
        agentImage:
          agent.agentImage || avatarUrlFor(avatarSeeds[0]),
        description: agent.instructions || "",
      })
    }
  }, [
    agent?.id,
    agent?.name,
    agent?.instructions,
    agent?.agentImage,
  ])

  useEffect(() => {
    if (!agentId || agentId === "new") return

    const loadAgent = async () => {
      try {
        const { data } = await axios.get(
          `/api/agent?agentId=${encodeURIComponent(agentId)}`
        )

        if (data?.agent) {
          Setformdata({
            name: data.agent.name || "",
            description: data.agent.instructions || "",
            agentImage:
              data.agent.agentImage ||
              avatarUrlFor(avatarSeeds[0]),
          })

          updateAgent(data.agent)
        }
      } catch (err) {
        console.log(
          "the error comes in loading the application",
          err
        )
      }
    }

    void loadAgent()
  }, [agentId, updateAgent])

  const handleNameChange = (val: string) => {
    Setformdata((prev) => ({
      ...prev,
      name: val,
    }))

    setSaved(false)

    if (agentId && agentId !== "new") {
      updateAgent({
        id: agentId,
        name: val,
      })

      onChange?.({
        name: val,
      })
    }
  }

  const handleDescriptionChange = (val: string) => {
    Setformdata((prev) => ({
      ...prev,
      description: val,
    }))

    setSaved(false)

    if (agentId && agentId !== "new") {
      updateAgent({
        id: agentId,
        instructions: val,
      })

      onChange?.({
        instructions: val,
      })
    }
  }

  const shuffleAvatar = () => {
    const next = (avatarIndex + 1) % avatarSeeds.length

    setAvatarIndex(next)

    const nextUrl = avatarUrlFor(avatarSeeds[next])

    Setformdata((prev) => ({
      ...prev,
      agentImage: nextUrl,
    }))

    setSaved(false)

    if (agentId && agentId !== "new") {
      updateAgent({
        id: agentId,
        agentImage: nextUrl,
      })

      onChange?.({
        agentImage: nextUrl,
      })
    }
  }

  const saveAgent = async () => {
    if (!agentId || agentId === "new" || isSaving) return

    setIsSaving(true)
    setSaved(false)
    setSaveError("")

    try {
      const response = await axios.patch<{
        agent?: Agent
        result?: Agent[]
      }>("/api/agent", {
        agentId,
        name: formdata.name.trim(),
        description: formdata.description.trim(),
        agentImage: formdata.agentImage,
        formdata: {
          agentId,
          ...formdata,
        },
      })

      const updated =
        response.data?.agent ||
        response.data?.result?.[0]

      if (updated) {
        updateAgent(updated)
        onSaved?.(updated)
      }

      setSaved(true)
    } catch (error) {
      console.log("error saving agent", error)
      setSaveError(
        "Unable to save changes. Please try again."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const renderPanel = () => {
    if (activePanel === "profile") {
      return (
        <div className="space-y-5">
          <div>
            <label
              className="text-sm font-medium text-zinc-800"
              htmlFor="agent-name"
            >
              Agent name
            </label>

            <input
              className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-teal-600 focus:ring-3 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
              id="agent-name"
              onChange={(e) =>
                handleNameChange(e.target.value)
              }
              value={formdata.name}
              disabled={!isAdmin}
              readOnly={!isAdmin}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                className="text-sm font-medium text-zinc-800"
                htmlFor="agent-description"
              >
                Instructions &amp; Behavior
              </label>
              <span className="text-xs text-zinc-400">
                Plain English
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Set how this bot acts and responds. Click a template to quickly load instructions:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                {
                  label: "🎧 Support Hero",
                  text: "You are a warm, empathetic customer support specialist. Your goal is to help users resolve issues quickly and politely. If referencing policies or guides from the knowledge base, explain them clearly in simple terms.",
                },
                {
                  label: "📚 Document Guru",
                  text: "You are an intelligent knowledge base assistant. Answer all questions strictly based on the provided documents and vector database. Cite specific documents whenever possible. If not found, say 'I don't have that information in my knowledge base.'",
                },
                {
                  label: "💼 Sales Advisor",
                  text: "You are a proactive and enthusiastic sales consultant. You help prospective customers understand product features, pricing, and key benefits. Ask clarifying questions to understand their needs.",
                },
                {
                  label: "🚀 Work Assistant",
                  text: "You are a versatile, highly organized workplace assistant. Assist with drafting clear emails, summarizing long documents, and organizing tasks concisely.",
                },
              ].map((template) => (
                <button
                  key={template.label}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => handleDescriptionChange(template.text)}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {template.label}
                </button>
              ))}
            </div>

            <textarea
              className="mt-2.5 min-h-36 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-6 text-zinc-800 outline-none transition focus:border-teal-600 focus:ring-3 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
              id="agent-description"
              onChange={(e) =>
                handleDescriptionChange(e.target.value)
              }
              value={formdata.description}
              disabled={!isAdmin}
              readOnly={!isAdmin}
            />
          </div>

          {saveError && (
            <p
              className="text-sm text-rose-700"
              role="alert"
            >
              {saveError}
            </p>
          )}
        </div>
      )
    }

    if (activePanel === "tools") {
      return (
        <div>
          <p className="text-sm leading-6 text-zinc-500">
            Choose what {formdata.name || "this agent"} can use
            while responding. Turning on a connector will
            prompt for API credentials.
          </p>

          <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {CONNECTORS.map((connector) => {
              const key =
                connector.id as keyof ToolSettings

              const isConnected = Boolean(tools[key])
              const Icon = connector.icon

              return (
                <div
                  className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3.5 transition hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"
                  key={connector.id}
                >
                  <span
                    onClick={() =>
                      setSelectedConnectorForCreds(
                        connector
                      )
                    }
                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition group-hover:scale-105 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    <Icon className="size-4" />
                  </span>

                  <div
                    onClick={() =>
                      setSelectedConnectorForCreds(
                        connector
                      )
                    }
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="block text-sm font-medium text-zinc-800 transition group-hover:text-teal-700 dark:text-zinc-200 dark:group-hover:text-teal-400">
                        {connector.name}
                      </span>

                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300">
                          <span className="size-1.5 animate-pulse rounded-full bg-teal-500" />
                          Connected
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                          Not connected
                        </span>
                      )}
                    </div>

                    <span className="mt-0.5 block text-xs leading-4 text-zinc-500 dark:text-zinc-400">
                      {connector.detail}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedConnectorForCreds(
                            connector
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 shadow-xs transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        title="Configure credentials"
                      >
                        <SlidersHorizontal className="size-3" />
                        Configure
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedConnectorForCreds(
                            connector
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50/70 px-2 py-1 text-[11px] font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-100 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/60"
                        title="Connect and enter credentials"
                      >
                        Connect
                      </button>
                    )}

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isConnected}
                      aria-label={`Toggle ${connector.name}`}
                      onClick={(e) => {
                        e.stopPropagation()

                        if (!isConnected) {
                          setSelectedConnectorForCreds(
                            connector
                          )
                        } else {
                          handleToggleConnector(
                            connector,
                            false
                          )
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1 ${isConnected
                        ? "bg-teal-600"
                        : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${isConnected
                          ? "translate-x-4"
                          : "translate-x-0"
                          }`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (activePanel === "schedule") {
      return (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5">
            <div>
              <p className="text-sm font-medium text-zinc-800">
                Weekly digest
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Send a customer signal summary every weekday.
              </p>
            </div>

            <Switch
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-zinc-600">
              Cadence

              <select
                className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-800 outline-none focus:border-teal-600"
                defaultValue="Weekdays"
              >
                <option>Weekdays</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </label>

            <label className="text-xs font-medium text-zinc-600">
              Time

              <select
                className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-800 outline-none focus:border-teal-600"
                defaultValue="09:00"
              >
                <option>09:00</option>
                <option>12:00</option>
                <option>16:00</option>
              </select>
            </label>
          </div>

          <p className="rounded-md bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
            {scheduleEnabled
              ? "Next run: tomorrow at 09:00"
              : "The schedule is paused."}
          </p>
        </div>
      )
    }

    if (activePanel === "knowledge") {
      const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDraggingOver(false)
        const dropped = Array.from(e.dataTransfer.files)
        if (dropped.length > 0) {
          setStagedFiles((prev) => [...prev, ...dropped])
        }
      }

      const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || [])
        if (selected.length > 0) {
          setStagedFiles((prev) => [...prev, ...selected])
        }
        e.target.value = ""
      }

      const removeFile = (index: number) => {
        setStagedFiles((prev) => prev.filter((_, i) => i !== index))
      }

      const handleDeleteDoc = async (docId?: string, index?: number) => {
        if (docId) {
          try {
            await axios.delete(`/api/documentprocess?documentId=${docId}`)
          } catch (e) {
            console.warn("Failed to delete document record:", e)
          }
        }
        if (typeof index === "number") {
          setUploadedDocs((prev) => prev.filter((_, i) => i !== index))
        }
      }

      const handleUpload = async () => {
        const hasFiles = stagedFiles.length > 0
        const hasText = knowledgeTextContent.trim().length > 0
        if (!hasFiles && !hasText) return

        setIsUploading(true)
        setUploadError("")

        const newResults: Array<{
          id?: string
          name: string
          uploadedAt: string
          chunksCount?: number
          fileType?: string
        }> = []

        // Upload files
        for (const file of stagedFiles) {
          try {
            const formData = new FormData()
            formData.append("file", file)
            if (agentId && agentId !== "new") {
              formData.append("agentId", agentId)
            }

            const { data } = await axios.post("/api/documentprocess", formData)
            newResults.push({
              id: data?.document?.id,
              name: file.name,
              uploadedAt: new Date().toLocaleTimeString(),
              chunksCount: data?.chunks || 1,
              fileType: file.name.split(".").pop() || "doc",
            })
          } catch (err: any) {
            setUploadError(
              `Failed to index "${file.name}": ${
                err?.response?.data?.message || err?.message || "Vector error"
              }`
            )
          }
        }

        // Upload pasted text if any
        if (hasText) {
          try {
            const formData = new FormData()
            formData.append("text", knowledgeTextContent.trim())
            formData.append(
              "title",
              knowledgeTextTitle.trim() || "Pasted Knowledge Notes"
            )
            if (agentId && agentId !== "new") {
              formData.append("agentId", agentId)
            }

            const { data } = await axios.post("/api/documentprocess", formData)
            newResults.push({
              id: data?.document?.id,
              name: knowledgeTextTitle.trim() || "Pasted Knowledge Notes",
              uploadedAt: new Date().toLocaleTimeString(),
              chunksCount: data?.chunks || 1,
              fileType: "note",
            })
            setKnowledgeTextContent("")
            setKnowledgeTextTitle("")
          } catch (err: any) {
            setUploadError(
              `Failed to index notes: ${
                err?.response?.data?.message || err?.message || "Vector error"
              }`
            )
          }
        }

        setUploadedDocs((prev) => [...newResults, ...prev])
        setStagedFiles([])
        setIsUploading(false)
      }

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-800">
                Vector Knowledge Base
              </p>
              <p className="text-xs text-zinc-500">
                Ground this bot with semantic search using Pinecone.
              </p>
            </div>
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10px] font-medium text-teal-700">
              Vector DB Active
            </span>
          </div>

          {/* Sub-tab selection */}
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setKnowledgeSubTab("files")}
              className={`flex-1 rounded-md py-1.5 text-center transition ${
                knowledgeSubTab === "files"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Upload Documents
            </button>
            <button
              type="button"
              onClick={() => setKnowledgeSubTab("text")}
              className={`flex-1 rounded-md py-1.5 text-center transition ${
                knowledgeSubTab === "text"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Paste Notes / FAQ
            </button>
          </div>

          {knowledgeSubTab === "files" ? (
            <div>
              <div
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
                  isDraggingOver
                    ? "border-teal-500 bg-teal-50"
                    : "border-zinc-300 hover:border-teal-400 hover:bg-zinc-50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDraggingOver(true)
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                  <Upload className="size-5" />
                </span>

                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    Drag &amp; drop documents here
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    PDF, TXT, MD, CSV, DOC
                  </p>
                </div>

                <button
                  className="mt-1 rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-teal-800"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  Browse Files
                </button>

                <input
                  accept=".pdf,.txt,.md,.csv,.doc,.docx"
                  className="hidden"
                  id="doc-file-input"
                  multiple
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  type="file"
                />
              </div>

              {stagedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Ready to index into Vector DB ({stagedFiles.length})
                  </p>

                  {stagedFiles.map((file, i) => (
                    <div
                      key={`staged-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-600">
                        <FileText className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-zinc-800 text-xs">
                        {file.name}
                      </span>
                      <button
                        className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        onClick={() => removeFile(i)}
                        title="Remove file"
                        type="button"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}

                  <Button
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white text-xs h-9"
                    disabled={isUploading}
                    onClick={handleUpload}
                    type="button"
                  >
                    {isUploading ? "Generating Vector Embeddings..." : "Process & Index Documents"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Topic / Title</label>
                <input
                  type="text"
                  value={knowledgeTextTitle}
                  onChange={(e) => setKnowledgeTextTitle(e.target.value)}
                  placeholder="e.g. Return Policy FAQ"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-xs outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Knowledge Content</label>
                <textarea
                  rows={4}
                  value={knowledgeTextContent}
                  onChange={(e) => setKnowledgeTextContent(e.target.value)}
                  placeholder="Paste policies, internal notes, or FAQs here..."
                  className="mt-1 w-full rounded-md border border-zinc-200 p-2.5 text-xs outline-none focus:border-teal-600 resize-none"
                />
              </div>
              <Button
                className="w-full bg-teal-700 hover:bg-teal-800 text-white text-xs h-9"
                disabled={isUploading || !knowledgeTextContent.trim()}
                onClick={handleUpload}
                type="button"
              >
                {isUploading ? "Indexing Notes..." : "Save to Vector Database"}
              </Button>
            </div>
          )}

          {uploadError && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {uploadError}
            </p>
          )}

          {/* Uploaded Documents List */}
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Indexed in Vector Database ({uploadedDocs.length})
            </p>

            {uploadedDocs.length > 0 ? (
              <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
                {uploadedDocs.map((doc, i) => (
                  <div
                    key={`uploaded-${i}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-teal-50/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-700">
                        <FileText className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">{doc.name}</p>
                        <p className="text-[10px] text-zinc-400">
                          {doc.chunksCount ? `${doc.chunksCount} vectors • ` : ""}
                          {doc.uploadedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Check className="size-3.5 text-teal-600" />
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id, i)}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-rose-600 transition"
                        title="Delete document"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-center text-xs text-zinc-400 py-3">
                No documents indexed in this bot's vector database yet.
              </p>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  const panel = panels.find(
    (item) => item.id === activePanel
  )

  return (
    <aside className="order-2 flex w-full shrink-0 flex-col overflow-hidden border-t border-zinc-200 bg-white lg:h-dvh lg:border-t-0 lg:border-l">
      <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 sm:h-16 sm:px-5">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            onClick={() => {
              if (onClose) {
                onClose()
              } else {
                router.push("/workspace")
              }
            }}
            type="button"
          >
            <span className="lg:hidden">
              Back to Chat
            </span>
          </button>

          <Button
            className="bg-teal-700 hover:bg-teal-800"
            size="sm"
            type="button"
            onClick={signout}
          >
            Logout
          </Button>
        </div>

        {isAdmin ? (
          <Button
            className="bg-teal-700 hover:bg-teal-800"
            disabled={isSaving}
            onClick={saveAgent}
            size="sm"
            type="button"
          >
            {saved ? (
              <>
                <Check className="size-3.5" />
                Saved
              </>
            ) : isSaving ? (
              "Saving..."
            ) : (
              "Save"
            )}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-500">
            <Lock className="size-3" />
            Read-only
          </span>
        )}
      </div>

      <div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              className="size-14 bg-teal-50"
              size="lg"
            >
              <AvatarImage
                alt="Selected agent avatar"
                src={formdata.agentImage}
              />

              <AvatarFallback>
                <Bot className="size-6" />
              </AvatarFallback>
            </Avatar>

            {isAdmin && (
              <button
                aria-label="Shuffle avatar"
                className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:border-teal-500 hover:text-teal-700"
                onClick={shuffleAvatar}
                title="Shuffle avatar"
                type="button"
              >
                <Shuffle className="size-3" />
              </button>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {formdata.name ||
                agent?.name ||
                "Untitled agent"}
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Customer strategist
            </p>
          </div>
        </div>
      </div>

      <nav
        className="grid grid-cols-4 gap-1 border-b border-zinc-200 px-3 py-2 sm:py-3"
        aria-label="Agent configuration"
      >
        {panels.map(
          ({ id, label, icon: Icon }) => (
            <button
              aria-label={label}
              className={`flex h-10 w-full items-center justify-center rounded-md transition sm:h-9 ${activePanel === id
                ? "bg-teal-50 text-teal-800"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              key={id}
              onClick={() => setActivePanel(id)}
              title={label}
              type="button"
            >
              <Icon className="size-4" />
            </button>
          )
        )}
      </nav>

      <section
        className={`min-h-0 flex-1 px-4 py-5 sm:px-5 ${activePanel === "tools"
          ? "overflow-y-auto"
          : "overflow-hidden"
          }`}
        aria-label={`${panel?.label} settings`}
      >
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Configuration
          </p>

          <h1 className="mt-2 text-base font-semibold text-zinc-900">
            {panel?.label}
          </h1>
        </div>

        {renderPanel()}
      </section>

      <ConnectorCredentialModal
        connector={selectedConnectorForCreds}
        isOpen={Boolean(selectedConnectorForCreds)}
        agentId={agentId}
        initialValues={
          selectedConnectorForCreds
            ? connectorCredentials[
            selectedConnectorForCreds.id
            ]
            : {}
        }
        isConnected={
          selectedConnectorForCreds
            ? Boolean(
              tools[selectedConnectorForCreds.id]
            )
            : false
        }
        onClose={() => {
          setSelectedConnectorForCreds(null)
        }}
        onSave={handleSaveCredentials}
        onDisconnect={handleDisconnectConnector}
      />
    </aside>
  )
}