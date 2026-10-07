"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { Agent } from "@/context/AgentContext"
import { AgentChatPanel } from "@/components/custom/Workspace/AgentChatPanel"
import { AgentConfigurationPanel } from "@/components/custom/Workspace/AgentConfigurationPanel"

export function CreateAgent({ agentId }: { agentId?: string }) {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)

  useEffect(() => {
    if (!agentId) return
    const getAgentConfig = async () => {
      try {
        const result = await axios.get(`/api/agent?agentId=${agentId}`)
        if (result.status === 200 && result.data?.agent) {
          setAgent(result.data.agent)
        }
      } catch (error) {
        console.error("Error loading agent:", error)
      }
    }
    void getAgentConfig()
  }, [agentId])

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f8faf9] text-zinc-900">
      <AgentChatPanel agent={agent} agentId={agentId} />
      <AgentConfigurationPanel
        agent={agent}
        onClose={() => router.push("/workspace")}
      />
    </div>
  )
}
