"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Bot, Compass, Plus, Sparkles } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"
import axios from "axios"
type Agent = {
  name: string
  role: string
  agentImage: string
}


const botImage = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff&radius=50`

export function AppSidebar() {
  const [activeAgent, setActiveAgent] = useState("Nova")
  const [agents, setAgents] = useState<Agent[]>([])
  const agendata = async () => {
    try {
      const res = await axios.get("/api/agent")
      console.log("the res is", res.data);

      if (res.status === 200) {
        setAgents(res.data)
      }
    } catch (error) {
      console.log("error", error)
    }
  }
  useEffect(() => {
    agendata()
  }, [])
  const user = useSession()
  useEffect(() => {
    console.log("appsidebar", user)
  }, [user])
  return (
    <aside className="flex h-dvh w-[17.5rem] shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 text-zinc-900">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm">
          <Sparkles className="size-4" strokeWidth={2.25} />
        </div>
        <span className="text-base font-semibold tracking-tight">Orbit</span>
      </div>

      <Link className="mt-7 flex h-10 w-full items-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400" href="/workspace/create-agent">
        <Plus className="size-4" strokeWidth={2.5} />
        Create New Agent
      </Link>

      <div className="mt-8 min-h-0 overflow-y-auto">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Your Agents</p>
        <nav className="mt-3 space-y-1" aria-label="Your agents">
          {agents.map((agent) => {
            const isActive = activeAgent === agent.name
            return (
              <button
                key={agent.name}
                className={`flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${isActive ? "bg-zinc-100 text-zinc-950" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                  }`}
                onClick={() => setActiveAgent(agent.name)}
                type="button"
              >
                <Avatar className="size-8" size="sm">
                  <AvatarImage alt="" src={agent.agentImage} />
                  <AvatarFallback className="bg-zinc-200 text-zinc-600"><Bot className="size-4" /></AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{agent.name}</span>
                  <span className="block truncate text-[11px] text-zinc-400">{agent.role}</span>
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
            <AvatarImage alt="Avery Stone" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&q=80" />
            <AvatarFallback className="bg-zinc-900 font-semibold text-white">AS</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-800">Avery Stone</span>
            <span className="block truncate text-xs text-zinc-400">Personal workspace</span>
          </span>
        </button>
      </div>
    </aside>
  )
}
