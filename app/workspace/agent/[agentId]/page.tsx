"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import axios from "axios"

import { AgentChatPanel } from "@/components/custom/Workspace/AgentChatPanel"
import { Agent, useAgents } from "@/context/AgentContext"
import { AgentConfigurationPanel } from "@/components/custom/Workspace/AgentConfigurationPanel"
import { AppSidebar } from "@/components/custom/Workspace/Appsidebar"

export default function AgentPage() {
  const params = useParams()
  const agentId = params?.agentId as string

  const { agents, updateAgent } = useAgents()
  const contextAgent = agents.find((a) => a.id === agentId)
  const [agent, setAgent] = useState<Agent | null>(contextAgent || null)
  const [mobileTab, setMobileTab] = useState<"chat" | "config">("chat")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (contextAgent) {
      setAgent(contextAgent)
    }
  }, [contextAgent])

  useEffect(() => {
    const loadAgent = async () => {
      try {
        const res = await axios.get(`/api/agent?agentId=${encodeURIComponent(agentId)}`)
        const loaded = res.data?.agent || res.data?.agentConfig?.[0]
        if (loaded) {
          setAgent(loaded)
          updateAgent(loaded)
        }
      } catch (error) {
        console.error("Error loading agent:", error)
      }
    }

    if (agentId) {
      loadAgent()
    }
  }, [agentId, updateAgent])

  const handleAgentChange = (changes: Partial<Agent>) => {
    if (!agentId) return
    const updated = { ...(agent || {}), ...changes, id: agentId } as Agent
    setAgent(updated)
    updateAgent(updated)
  }

  return (
    <div className="relative flex h-dvh flex-col bg-[#f8faf9] text-zinc-900 lg:flex-row lg:overflow-hidden">
      {/* Mobile Sidebar Slide-Over Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl transition-transform animate-in slide-in-from-left duration-200">
            <AppSidebar isMobile onClose={() => setIsSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Chat Panel */}
      <div
        className={`min-h-0 flex-1 lg:overflow-hidden ${
          mobileTab === "chat" ? "flex flex-col h-full" : "hidden lg:flex lg:flex-col"
        }`}
      >
        <AgentChatPanel
          agent={agent}
          agentId={agentId}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenConfig={() => setMobileTab("config")}
        />
      </div>

      {/* Configuration Panel */}
      <div
        className={`w-full shrink-0 lg:w-[400px] ${
          mobileTab === "config" ? "flex flex-col h-full overflow-y-auto" : "hidden lg:flex lg:flex-col"
        }`}
      >
        <AgentConfigurationPanel
          agent={agent}
          onChange={handleAgentChange}
          onSaved={(updatedAgent) => {
            setAgent(updatedAgent)
            updateAgent(updatedAgent)
          }}
          onClose={() => setMobileTab("chat")}
        />
      </div>
    </div>
  )
}
