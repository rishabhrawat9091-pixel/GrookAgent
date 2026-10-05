"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import axios from "axios"
import { ArrowLeft, Bot, CalendarClock, Check, ChevronDown, Clock3, Database, FileText, Globe2, Mail, MessageSquareText, MoreHorizontal, Paperclip, Settings2, ShieldCheck, Shuffle, SlidersHorizontal, Upload, UserRoundCog, Wrench, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Agent, useAgents } from "@/context/AgentContext"
import { CONNECTORS, ConnectorConfig, ConnectorCredentialModal, ConnectorId } from "./ConnectorCredentialModal"

export type Panel = "profile" | "tools" | "schedule" | "knowledge" | "management"
export type ToolSettings = { gmail: boolean; telegram: boolean }

type AgentConfigurationPanelProps = {
  agent: Agent | null
  onChange?: (changes: Partial<Agent>) => void
  onSaved?: (agent: Agent) => void
  onClose?: () => void
}

const panels: { id: Panel; label: string; icon: typeof UserRoundCog }[] = [
  { id: "profile", label: "Profile", icon: UserRoundCog },
  { id: "tools", label: "Connected tools", icon: Wrench },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "knowledge", label: "Knowledge", icon: Database },
  { id: "management", label: "Management", icon: Settings2 },
]

const avatarSeeds = ["aster-field", "milo-lab", "sol-coach", "juniper-plan", "piper-ops"]
const avatarUrlFor = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}&backgroundColor=fef3c7,dbeafe,dcfce7,fce7f3,e0f2fe&radius=50`

export function AgentConfigurationPanel({ agent, onChange, onSaved, onClose }: AgentConfigurationPanelProps) {
  const params = useParams()
  const agentId = (params?.agentId as string) || agent?.id || ""
  const router = useRouter()
  const { updateAgent } = useAgents()

  const [activePanel, setActivePanel] = useState<Panel>("profile")
  const [avatarIndex, setAvatarIndex] = useState(0)
  const [tools, setTools] = useState<ToolSettings>({ gmail: false, telegram: false })
  const [scheduleEnabled, setScheduleEnabled] = useState(true)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  // Connector credentials state (Frontend)
  const [selectedConnectorForCreds, setSelectedConnectorForCreds] = useState<ConnectorConfig | null>(null)
  const [connectorCredentials, setConnectorCredentials] = useState<Record<ConnectorId, Record<string, string>>>({
    gmail: {},
    telegram: {},
  })

  // Load persisted connector state from DB when agent is known
  useEffect(() => {
    if (!agentId || agentId === "new") return
    const loadConnectors = async () => {
      try {
        const res = await fetch(`/api/connector?agentId=${encodeURIComponent(agentId)}`)
        if (!res.ok) return
        const data = await res.json() as { connectors?: Array<{ connectorType: string; config?: Record<string, string> | null }> }
        if (!Array.isArray(data.connectors)) return

        const updatedCreds: Record<ConnectorId, Record<string, string>> = {
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
            updatedCreds[type] = (conn.config as Record<string, string>) ?? {}
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

  const handleToggleConnector = (conn: ConnectorConfig, checked: boolean) => {
    if (checked) {
      // Opening/turning on the connector asks for credentials in the frontend
      setSelectedConnectorForCreds(conn)
    } else {
      // Turning off disables the connector
      setTools((current) => ({ ...current, [conn.id]: false }))
    }
  }

  const handleSaveCredentials = (connectorId: ConnectorId, creds: Record<string, string>) => {
    setConnectorCredentials((prev) => ({ ...prev, [connectorId]: creds }))
    setTools((current) => ({ ...current, [connectorId]: true }))
  }

  const handleDisconnectConnector = (connectorId: ConnectorId) => {
    setConnectorCredentials((prev) => ({ ...prev, [connectorId]: {} }))
    setTools((current) => ({ ...current, [connectorId]: false }))
  }

  // PDF upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [uploadedDocs, setUploadedDocs] = useState<{ name: string; uploadedAt: string }[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const [formdata, Setformdata] = useState({
    name: agent?.name || "",
    agentImage: agent?.agentImage || avatarUrlFor(avatarSeeds[0]),
    description: agent?.instructions || "",
  })

  useEffect(() => {
    if (agent) {
      Setformdata({
        name: agent.name || "",
        agentImage: agent.agentImage || avatarUrlFor(avatarSeeds[0]),
        description: agent.instructions || "",
      })
    }
  }, [agent?.id, agent?.name, agent?.instructions, agent?.agentImage])

  useEffect(() => {
    if (!agentId || agentId === "new") return

    const loadAgent = async () => {
      try {
        const { data } = await axios.get(`/api/agent?agentId=${encodeURIComponent(agentId)}`)
        if (data?.agent) {
          Setformdata({
            name: data.agent.name || "",
            description: data.agent.instructions || "",
            agentImage: data.agent.agentImage || avatarUrlFor(avatarSeeds[0]),
          })
          updateAgent(data.agent)
        }
      } catch (err) {
        console.log("the error comes in loading the application", err)
      }
    }

    void loadAgent()
  }, [agentId, updateAgent])

  const handleNameChange = (val: string) => {
    Setformdata((prev) => ({ ...prev, name: val }))
    setSaved(false)
    if (agentId && agentId !== "new") {
      updateAgent({ id: agentId, name: val })
      onChange?.({ name: val })
    }
  }

  const handleDescriptionChange = (val: string) => {
    Setformdata((prev) => ({ ...prev, description: val }))
    setSaved(false)
    if (agentId && agentId !== "new") {
      updateAgent({ id: agentId, instructions: val })
      onChange?.({ instructions: val })
    }
  }

  const shuffleAvatar = () => {
    const next = (avatarIndex + 1) % avatarSeeds.length
    setAvatarIndex(next)
    const nextUrl = avatarUrlFor(avatarSeeds[next])
    Setformdata((prev) => ({ ...prev, agentImage: nextUrl }))
    setSaved(false)
    if (agentId && agentId !== "new") {
      updateAgent({ id: agentId, agentImage: nextUrl })
      onChange?.({ agentImage: nextUrl })
    }
  }

  const saveAgent = async () => {
    if (!agentId || agentId === "new" || isSaving) return

    setIsSaving(true)
    setSaved(false)
    setSaveError("")

    try {
      const response = await axios.patch<{ agent?: Agent; result?: Agent[] }>(`/api/agent`, {
        agentId,
        name: formdata.name.trim(),
        description: formdata.description.trim(),
        agentImage: formdata.agentImage,
        formdata: {
          agentId,
          ...formdata,
        },
      })

      const updated = response.data?.agent || response.data?.result?.[0]
      if (updated) {
        updateAgent(updated)
        onSaved?.(updated)
      }
      setSaved(true)
    } catch (error) {
      console.log("error saving agent", error)
      setSaveError("Unable to save changes. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const renderPanel = () => {
    if (activePanel === "profile") {
      return (
        <div className="space-y-5 ">
          <div>
            <label className="text-sm font-medium text-zinc-800" htmlFor="agent-name">
              Agent name
            </label>
            <input
              className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-teal-600 focus:ring-3 focus:ring-teal-100"
              id="agent-name"
              onChange={(e) => handleNameChange(e.target.value)}
              value={formdata.name}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-800" htmlFor="agent-description">
              Description
            </label>
            <textarea
              className="mt-2 min-h-31 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-6 text-zinc-800 outline-none transition focus:border-teal-600 focus:ring-3 focus:ring-teal-100"
              id="agent-description"
              onChange={(e) => handleDescriptionChange(e.target.value)}
              value={formdata.description}
            />
          </div>
          {saveError && <p className="text-sm text-rose-700" role="alert">{saveError}</p>}
        </div>
      )
    }

    if (activePanel === "tools") {
      return (
        <div>
          <p className="text-sm leading-6 text-zinc-500">
            Choose what {formdata.name || "this agent"} can use while responding. Turning on a connector will prompt for API credentials.
          </p>
          <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {CONNECTORS.map((connector) => {
              const key = connector.id as keyof ToolSettings
              const isConnected = Boolean(tools[key])
              const Icon = connector.icon
              return (
                <div
                  className="flex items-center gap-3 py-3.5 transition group hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 px-2 -mx-2 rounded-xl"
                  key={connector.id}
                >
                  <span
                    onClick={() => setSelectedConnectorForCreds(connector)}
                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition group-hover:scale-105 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    <Icon className="size-4" />
                  </span>

                  <div
                    onClick={() => setSelectedConnectorForCreds(connector)}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition">
                        {connector.name}
                      </span>
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300">
                          <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
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

                  <div className="flex items-center gap-2 shrink-0">
                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() => setSelectedConnectorForCreds(connector)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 shadow-xs transition"
                        title="Configure credentials"
                      >
                        <SlidersHorizontal className="size-3" />
                        Configure
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedConnectorForCreds(connector)}
                        className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50/70 px-2 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-100 hover:border-teal-300 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/60 transition"
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
                          setSelectedConnectorForCreds(connector)
                        } else {
                          handleToggleConnector(connector, false)
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1 ${isConnected ? "bg-teal-600" : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${isConnected ? "translate-x-4" : "translate-x-0"
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
              <p className="text-sm font-medium text-zinc-800">Weekly digest</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Send a customer signal summary every weekday.</p>
            </div>
            <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-zinc-600">
              Cadence
              <select className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-800 outline-none focus:border-teal-600" defaultValue="Weekdays">
                <option>Weekdays</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </label>
            <label className="text-xs font-medium text-zinc-600">
              Time
              <select className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-800 outline-none focus:border-teal-600" defaultValue="09:00">
                <option>09:00</option>
                <option>12:00</option>
                <option>16:00</option>
              </select>
            </label>
          </div>
          <p className="rounded-md bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
            {scheduleEnabled ? "Next run: tomorrow at 09:00" : "The schedule is paused."}
          </p>
        </div>
      )
    }

    if (activePanel === "knowledge") {
      const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDraggingOver(false)
        const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf")
        if (dropped.length > 0) setPdfFiles((prev) => [...prev, ...dropped])
      }

      const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []).filter((f) => f.type === "application/pdf")
        if (selected.length > 0) setPdfFiles((prev) => [...prev, ...selected])
        e.target.value = ""
      }

      const removeFile = (index: number) => {
        setPdfFiles((prev) => prev.filter((_, i) => i !== index))
      }

      const handleUpload = async () => {
        if (pdfFiles.length === 0) return
        setIsUploading(true)
        setUploadError("")

        const results: { name: string; uploadedAt: string }[] = []
        for (const file of pdfFiles) {
          try {
            const formData = new FormData()
            formData.append("file", file)
            await axios.post("/api/documentprocess", formData)
            results.push({ name: file.name, uploadedAt: new Date().toLocaleTimeString() })
          } catch (err: any) {
            setUploadError(`Failed to upload "${file.name}": ${err?.response?.data?.message || err?.message || "Unknown error"}`)
          }
        }

        setUploadedDocs((prev) => [...prev, ...results])
        setPdfFiles([])
        setIsUploading(false)
      }

      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-zinc-500">Upload PDF documents to ground this agent in your team&apos;s knowledge.</p>

          {/* Drop zone */}
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${isDraggingOver ? "border-teal-500 bg-teal-50" : "border-zinc-300 hover:border-teal-400 hover:bg-zinc-50"
              }`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <Upload className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-800">Drag &amp; drop PDFs here</p>
              <p className="mt-0.5 text-xs text-zinc-400">or click to browse your files</p>
            </div>
            <button
              className="mt-1 rounded-md bg-teal-700 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-teal-800"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Browse PDFs
            </button>
            <input
              accept="application/pdf"
              className="hidden"
              id="pdf-file-input"
              multiple
              onChange={handleFileSelect}
              ref={fileInputRef}
              type="file"
            />
          </div>

          {/* Staged files (not yet uploaded) */}
          {pdfFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Ready to upload</p>
              {pdfFiles.map((file, i) => (
                <div key={`staged-${i}`} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                    <FileText className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-800">{file.name}</span>
                    <span className="text-xs text-zinc-400">{(file.size / 1024).toFixed(1)} KB</span>
                  </span>
                  <button
                    className="shrink-0 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                    onClick={() => removeFile(i)}
                    title="Remove file"
                    type="button"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {uploadError && (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{uploadError}</p>
              )}

              <button
                className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
                disabled={isUploading}
                id="upload-pdf-btn"
                onClick={handleUpload}
                type="button"
              >
                {isUploading ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Uploading…
                  </>
                ) : (
                  <><Upload className="size-4" /> Upload {pdfFiles.length === 1 ? "1 PDF" : `${pdfFiles.length} PDFs`}</>
                )}
              </button>
            </div>
          )}

          {/* Already uploaded docs */}
          {uploadedDocs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Uploaded documents</p>
              {uploadedDocs.map((doc, i) => (
                <div key={`uploaded-${i}`} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-teal-50 px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-700">
                    <FileText className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-teal-900">{doc.name}</span>
                    <span className="text-xs text-teal-600">Uploaded at {doc.uploadedAt}</span>
                  </span>
                  <Check className="size-4 shrink-0 text-teal-600" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {uploadedDocs.length === 0 && pdfFiles.length === 0 && (
            <p className="text-center text-xs text-zinc-400">No documents uploaded yet.</p>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="border-b border-zinc-200 pb-4">
          <p className="text-sm font-medium text-zinc-800">Agent ownership</p>
          <button className="mt-3 flex w-full items-center justify-between rounded-md border border-zinc-200 px-3 py-2.5 text-left text-sm text-zinc-700" type="button">
            Avery Stone <ChevronDown className="size-4 text-zinc-400" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <p className="text-sm font-medium text-zinc-800">Require approval</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Review external actions before they run.</p>
          </div>
          <Switch defaultChecked />
        </div>
        <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-rose-200 text-sm font-medium text-rose-700 transition hover:bg-rose-50" type="button">
          <ShieldCheck className="size-4" /> Archive agent
        </button>
      </div>
    )
  }

  const panel = panels.find((item) => item.id === activePanel)

  return (
    <aside className="order-2 flex w-full shrink-0 flex-col overflow-hidden border-t border-zinc-200 bg-white lg:h-dvh lg:border-t-0 lg:border-l">
      <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 sm:h-16 sm:px-5">
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
          <ArrowLeft className="size-4" />
          <span className="lg:hidden">Back to Chat</span>
          <span className="hidden lg:inline">{formdata.name || agent?.name || "Agent"}</span>
        </button>
        <Button
          className="bg-teal-700 hover:bg-teal-800"
          disabled={isSaving}
          onClick={saveAgent}
          size="sm"
          type="button"
        >
          {saved ? <><Check className="size-3.5" /> Saved</> : isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="size-14 bg-teal-50" size="lg">
              <AvatarImage alt="Selected agent avatar" src={formdata.agentImage} />
              <AvatarFallback>
                <Bot className="size-6" />
              </AvatarFallback>
            </Avatar>
            <button
              aria-label="Shuffle avatar"
              className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:border-teal-500 hover:text-teal-700"
              onClick={shuffleAvatar}
              title="Shuffle avatar"
              type="button"
            >
              <Shuffle className="size-3" />
            </button>
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{formdata.name || agent?.name || "Untitled agent"}</p>
            <p className="mt-1 text-xs text-zinc-500">Customer strategist</p>
          </div>
        </div>
      </div>

      <nav className="grid grid-cols-5 gap-1 border-b border-zinc-200 px-3 py-2 sm:py-3" aria-label="Agent configuration">
        {panels.map(({ id, label, icon: Icon }) => (
          <button
            aria-label={label}
            className={`flex h-10 w-full items-center justify-center rounded-md transition sm:h-9 ${activePanel === id ? "bg-teal-50 text-teal-800" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            key={id}
            onClick={() => setActivePanel(id)}
            title={label}
            type="button"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </nav>

      <section
        className={`min-h-0 flex-1 px-4 py-5 sm:px-5 ${activePanel === "tools" ? "overflow-y-auto" : "overflow-hidden"}`}
        aria-label={`${panel?.label} settings`}
      >
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Configuration</p>
          <h1 className="mt-2 text-base font-semibold text-zinc-900">{panel?.label}</h1>
        </div>
        {renderPanel()}
      </section>

      {/* Credential configuration modal for connectors */}
      <ConnectorCredentialModal
        connector={selectedConnectorForCreds}
        isOpen={Boolean(selectedConnectorForCreds)}
        agentId={agentId}
        initialValues={
          selectedConnectorForCreds
            ? connectorCredentials[selectedConnectorForCreds.id]
            : {}
        }
        isConnected={
          selectedConnectorForCreds
            ? Boolean(tools[selectedConnectorForCreds.id])
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
