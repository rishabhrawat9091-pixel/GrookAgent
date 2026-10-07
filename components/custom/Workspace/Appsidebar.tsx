"use client"

import Link from "next/link"
import { Bot, Compass, Plus, Sparkles, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useParams, useRouter } from "next/navigation"
import { useAgents } from "@/context/AgentContext"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"

type AppSidebarProps = {
  onClose?: () => void
  isMobile?: boolean
  role?: string
}

export function AppSidebar({ onClose, isMobile }: AppSidebarProps) {
  const router = useRouter()
  const params = useParams()
  const [toggler, Settoggler] = useState<boolean>(true)
  const currentAgentId = params?.agentId as string | undefined
  const { agents } = useAgents()
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.user?.role === "employee") {
      Settoggler(false)
    } else {
      Settoggler(true)
    }
  }, [session])

  return (
    <aside
      className={
        isMobile
          ? "flex h-full w-full flex-col bg-white px-3 py-4 text-zinc-900"
          : "hidden lg:flex h-dvh w-[17.5rem] shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 text-zinc-900"
      }
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm">
            <Sparkles className="size-4" strokeWidth={2.25} />
          </div>
          <span className="text-base font-semibold tracking-tight">Orbit</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {toggler && (
        <Link
          href="/workspace/create-agent"
          onClick={() => onClose?.()}
          className="mt-7 flex h-10 w-full items-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Create New Agent
        </Link>
      )}

      <div className="mt-8 min-h-0 overflow-y-auto">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Your Agents</p>
        <nav className="mt-3 space-y-1" aria-label="Your agents">
          {agents.map((agent) => {
            const isActive = currentAgentId === agent.id
            return (
              <button
                key={agent.id}
                className={`flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                  isActive ? "bg-zinc-100 text-zinc-950 font-medium" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                }`}
                onClick={() => {
                  router.push(`/workspace/agent/${agent.id}`)
                  onClose?.()
                }}
                type="button"
              >
                <Avatar className="size-8" size="sm">
                  <AvatarImage alt={agent.name || "Agent"} src={agent.agentImage} />
                  <AvatarFallback className="bg-zinc-200 text-zinc-600">
                    <Bot className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{agent.name || "Untitled agent"}</span>
                  <span className="block truncate text-[11px] text-zinc-400">
                    {agent.instructions || "No description"}
                  </span>
                </span>
                {isActive && <span className="size-1.5 rounded-full bg-zinc-900" aria-label="Active" />}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-zinc-100 pt-3">
        <button className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400" type="button">
          <Compass className="size-4" />
          Marketing
        </button>
        <button className="mt-2 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400" type="button">
          <Avatar className="size-8">
            <AvatarImage alt="User" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&q=80" />
            <AvatarFallback className="bg-zinc-900 font-semibold text-white">AS</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-800">{session?.user?.name || "Workspace User"}</span>
            <span className="block truncate text-xs text-zinc-400">{session?.user?.email || "Personal workspace"}</span>
          </span>
        </button>
      </div>
    </aside>
  )
}
