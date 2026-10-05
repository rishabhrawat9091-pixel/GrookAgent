"use client"

import { FormEvent, useEffect, useRef, useState, KeyboardEvent } from "react"
import {
  ArrowLeft, Bell, Bot, Check, Mail, MoreHorizontal, PanelLeft,
  Paperclip, RefreshCw, SendHorizontal, SlidersHorizontal, Sparkles, X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import axios from "axios"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Agent } from "@/context/AgentContext"

type AgentChatPanelProps = {
  agent: Agent | null
  agentId?: string
  onOpenSidebar?: () => void
  onOpenConfig?: () => void
}

type ChatMessage = {
  id: number
  author: "agent" | "user"
  text: string
  toolsExecuted?: string[]
}

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  source: string | null
  isRead: string
  metadata: Record<string, string> | null
  createdAt: string
}

const QUICK_PROMPTS = [
  "What can you help me with?",
  "Give me a quick summary",
  "Draft an email update",
]

export function AgentChatPanel({ agent, agentId, onOpenSidebar, onOpenConfig }: AgentChatPanelProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const effectiveAgentId = agentId || agent?.id

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  // Load notifications on mount and every 60s
  useEffect(() => {
    if (!effectiveAgentId) return
    void loadNotifications()
    const interval = setInterval(() => void loadNotifications(), 60_000)
    return () => clearInterval(interval)
  }, [effectiveAgentId])

  // Close notif dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const loadNotifications = async () => {
    if (!effectiveAgentId) return
    try {
      const res = await axios.get(`/api/notifications?agentId=${encodeURIComponent(effectiveAgentId)}&limit=15`)
      setNotifications(res.data.notifications || [])
      setUnreadCount(res.data.unreadCount || 0)
    } catch {
      // silent
    }
  }

  const pollInbox = async () => {
    if (!effectiveAgentId || isPolling) return
    setIsPolling(true)
    try {
      await axios.post("/api/notifications", { agentId: effectiveAgentId })
      await loadNotifications()
    } catch {
      // silent
    } finally {
      setIsPolling(false)
    }
  }

  const markAllRead = async () => {
    if (!effectiveAgentId) return
    try {
      await axios.patch("/api/notifications", { agentId: effectiveAgentId, markAllRead: true })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: "true" })))
    } catch {
      // silent
    }
  }

  const markOneRead = async (notifId: string) => {
    if (!effectiveAgentId) return
    try {
      await axios.patch("/api/notifications", { agentId: effectiveAgentId, notificationId: notifId })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: "true" } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // silent
    }
  }

  const submitMessage = async (messageText: string) => {
    const message = messageText.trim()
    if (!message || !agent || isSending) return

    const userMessage: ChatMessage = { id: Date.now(), author: "user", text: message }
    const conversation = [...messages, userMessage]

    setDraft("")
    setMessages(conversation)
    setIsSending(true)

    try {
      const response = await axios.post("/api/chat", {
        message,
        agentId: effectiveAgentId,
        role: "market-analyst",
        messages: conversation.map((item) => ({
          role: item.author === "agent" ? "assistant" : "user",
          content: item.text,
        })),
      })

      const responseMessage =
        response.data?.data ||
        response.data?.message ||
        (typeof response.data === "string" ? response.data : "")

      if (!responseMessage) {
        throw new Error(response.data?.error || "Received empty response from assistant")
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          author: "agent",
          text: responseMessage,
          toolsExecuted: response.data?.toolsExecuted,
        },
      ])

      // Refresh notifications after agent response (it may have sent emails)
      if (response.data?.toolsExecuted?.length > 0) {
        await loadNotifications()
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error || error?.message || "Unable to send message"
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, author: "agent", text: errorMessage },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitMessage(draft)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void submitMessage(draft)
    }
  }

  return (
    <main className="order-1 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f8faf9] lg:h-dvh">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200/90 bg-white px-2.5 sm:h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onOpenSidebar ? (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-50 text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950 active:scale-95 lg:hidden shadow-2xs"
              aria-label="Open navigation sidebar"
            >
              <PanelLeft className="size-4.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/workspace")}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 lg:hidden"
              aria-label="Back to workspace"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}

          <div className="relative shrink-0">
            <Avatar className="size-8 sm:size-9 border border-zinc-200/80 shadow-2xs" size="sm">
              <AvatarImage alt={agent?.name ?? "Agent"} src={agent?.agentImage} />
              <AvatarFallback><Bot className="size-4" /></AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
            />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-xs sm:text-sm font-semibold text-zinc-900 max-w-[110px] xs:max-w-[170px] sm:max-w-xs md:max-w-none">
              {agent?.name ?? "Loading..."}
            </h2>
            <p className="truncate text-[10px] sm:text-[11px] text-zinc-500 max-w-[110px] xs:max-w-[170px] sm:max-w-xs md:max-w-none">
              {agent?.instructions || "Ready to assist you"}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {onOpenConfig && (
            <button
              onClick={onOpenConfig}
              className="flex items-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-50/70 px-2.5 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100/80 active:scale-95 lg:hidden shadow-2xs"
              title="Open Configuration"
              type="button"
              aria-label="Open Configuration"
            >
              <SlidersHorizontal className="size-3.5 text-teal-700" />
              <span>Configure</span>
            </button>
          )}

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => { setShowNotifs((v) => !v); if (!showNotifs) void loadNotifications() }}
              className="relative flex size-8 sm:size-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              title="Marketing email notifications"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-xl border border-zinc-200 bg-white shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-teal-600" />
                    <span className="text-sm font-semibold text-zinc-900">Marketing Inbox</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void pollInbox()}
                      disabled={isPolling}
                      className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                      title="Check for new emails"
                    >
                      <RefreshCw className={`size-3.5 ${isPolling ? "animate-spin" : ""}`} />
                    </button>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        title="Mark all as read"
                      >
                        <Check className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotifs(false)}
                      className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Notification List */}
                <div className="max-h-72 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <Mail className="size-7 text-zinc-300" />
                      <p className="text-xs text-zinc-400">No marketing emails yet.</p>
                      <button
                        type="button"
                        onClick={() => void pollInbox()}
                        disabled={isPolling}
                        className="mt-1 rounded-md bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
                      >
                        {isPolling ? "Checking..." : "Check inbox now"}
                      </button>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`group flex items-start gap-3 border-b border-zinc-50 px-4 py-3 transition hover:bg-zinc-50/60 ${notif.isRead === "false" ? "bg-teal-50/30" : ""}`}
                        onClick={() => { if (notif.isRead === "false") void markOneRead(notif.id) }}
                      >
                        <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${notif.isRead === "false" ? "bg-teal-100 text-teal-700" : "bg-zinc-100 text-zinc-400"}`}>
                          <Mail className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <p className={`truncate text-xs font-medium ${notif.isRead === "false" ? "text-zinc-900" : "text-zinc-500"}`}>
                              {notif.title}
                            </p>
                            {notif.isRead === "false" && (
                              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-teal-500" />
                            )}
                          </div>
                          {notif.body && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-400">
                              {notif.body}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-1.5">
                            {notif.source && (
                              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                                {notif.source}
                              </span>
                            )}
                            <span className="text-[9px] text-zinc-300">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {/* Quick action — summarize in chat */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void markOneRead(notif.id)
                              setShowNotifs(false)
                              void submitMessage(`Summarize this marketing email: Subject: "${notif.title}" — ${notif.body || ""}`)
                            }}
                            className="mt-1.5 text-[10px] font-medium text-teal-600 opacity-0 transition group-hover:opacity-100 hover:underline"
                          >
                            Summarize in chat →
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="border-t border-zinc-100 px-4 py-2.5 text-center">
                    <p className="text-[10px] text-zinc-400">
                      Auto-refreshes every 60s · <button type="button" onClick={() => void pollInbox()} className="text-teal-600 hover:underline">Poll now</button>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <span className={`hidden text-xs font-medium sm:inline ${isActive ? "text-teal-700" : "text-zinc-500"}`}>
            {isActive ? "Active" : "Paused"}
          </span>

          <Switch
            aria-label="Agent active status"
            checked={isActive}
            onCheckedChange={setIsActive}
            className="scale-90 sm:scale-100"
          />

          <button
            className="hidden sm:flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            title="More options"
            type="button"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Agent conversation">
        <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-5">
          <div
            className="flex-1 space-y-4 sm:space-y-5 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-8 sm:py-16 text-center px-2">
                <div className="relative">
                  <div className="flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-teal-50 border border-teal-100 text-teal-700 shadow-xs">
                    <Sparkles className="size-7 sm:size-8" />
                  </div>
                </div>

                <div className="max-w-xs space-y-1">
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-800">
                    Chat with {agent?.name ?? "Agent"}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                    {agent?.instructions
                      ? agent.instructions.slice(0, 100) + (agent.instructions.length > 100 ? "..." : "")
                      : "Ask questions, send emails, search the web, or monitor your inbox."}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-md">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void submitMessage(prompt)}
                      className="rounded-full border border-zinc-200/90 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-900 active:scale-95 shadow-2xs"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                className={`flex gap-2.5 sm:gap-3 ${message.author === "user" ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                {message.author === "agent" && (
                  <Avatar className="mt-0.5 size-7 shrink-0 border border-zinc-200/70" size="sm">
                    <AvatarImage alt={agent?.name ?? "Agent"} src={agent?.agentImage} />
                    <AvatarFallback><Bot className="size-3.5" /></AvatarFallback>
                  </Avatar>
                )}

                <div className="flex flex-col gap-1.5 max-w-[85%] sm:max-w-[78%]">
                  {/* Tool execution badges */}
                  {message.toolsExecuted && message.toolsExecuted.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {message.toolsExecuted.map((tool, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700"
                        >
                          <span className="size-1.5 rounded-full bg-teal-500" />
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-5 sm:leading-6 shadow-2xs break-words whitespace-pre-wrap ${message.author === "user"
                      ? "rounded-tr-xs bg-zinc-900 text-white"
                      : "rounded-tl-xs border border-zinc-200/90 bg-white text-zinc-800"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex gap-2.5 sm:gap-3 items-center">
                <Avatar className="mt-0.5 size-7 shrink-0 border border-zinc-200/70" size="sm">
                  <AvatarImage alt={agent?.name ?? "Agent"} src={agent?.agentImage} />
                  <AvatarFallback><Bot className="size-3.5" /></AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-xs border border-zinc-200/90 bg-white px-3.5 py-2.5 shadow-2xs">
                  <span className="size-1.5 animate-bounce rounded-full bg-teal-600" />
                  <span className="size-1.5 animate-bounce rounded-full bg-teal-600 [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-teal-600 [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="shrink-0 pt-2 sm:pt-3">
            <form
              className="flex min-h-11 sm:min-h-13 items-end gap-1.5 sm:gap-2 rounded-2xl border border-zinc-300/90 bg-white p-1.5 sm:p-2 shadow-xs transition-all focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100"
              onSubmit={handleSubmit}
            >
              <button
                className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                title="Attach context"
                type="button"
              >
                <Paperclip className="size-4" />
              </button>

              <textarea
                suppressHydrationWarning
                className="max-h-24 sm:max-h-28 min-h-8 sm:min-h-9 flex-1 resize-none bg-transparent py-1.5 sm:py-2 text-xs sm:text-sm leading-5 text-zinc-800 outline-none placeholder:text-zinc-400 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                disabled={!mounted || !agent || isSending}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${agent?.name ?? "agent"}… e.g. "Send an email to john@example.com"`}
                rows={1}
                value={draft}
              />

              <Button
                suppressHydrationWarning
                aria-label="Send message"
                className="h-8 sm:h-9 shrink-0 rounded-xl bg-teal-700 px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50 transition-all active:scale-95 shadow-2xs"
                disabled={!mounted || !agent || isSending || !draft.trim()}
                size="sm"
                type="submit"
              >
                <span className="hidden sm:inline mr-1">{isSending ? "Sending..." : "Send"}</span>
                <SendHorizontal className="size-3.5" />
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}