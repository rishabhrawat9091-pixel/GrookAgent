"use client"

import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"

export type Agent = {
  id: string
  name: string
  instructions: string
  agentImage: string
  createdAt?: string
  userEmail?: string
  currentAgentId: string
}

type AgentContextValue = {
  agents: Agent[]
  updateAgent: (agent: Partial<Agent> & { id: string }) => void
  refreshAgents: () => Promise<void>
  clickAgent: (agentid: string) => Promise<void>
}

const AgentContext = createContext<AgentContextValue | null>(null)

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentid, setAgentid] = useState<string>()
  const { status } = useSession()

  const clickAgent = async (agentid: string) => {
    try {
      setAgentid(agentid)
    } catch (error) {
      console.log(error)
    }
  }

  const refreshAgents = useCallback(async () => {
    try {
      const response = await fetch("/api/agent")
      if (!response.ok) return

      const data = (await response.json()) as Agent[]
      if (Array.isArray(data)) {
        setAgents(data)
      }
    } catch (error) {
      console.error("Unable to load agents", error)
    }
  }, [])

  // Only fetch agents once the NextAuth session is confirmed authenticated.
  // Without this, the very first fetch fires before the session cookie is ready
  // and the /api/agent route returns 401 → sidebar stays empty forever.
  useEffect(() => {
    if (status === "authenticated") {
      void refreshAgents()
    }
  }, [status, refreshAgents])

  const updateAgent = useCallback((updatedAgent: Partial<Agent> & { id: string }) => {
    setAgents((current) => {
      const exists = current.some((agent) => agent.id === updatedAgent.id)
      if (!exists) {
        return [...current, updatedAgent as Agent]
      }
      return current.map((agent) =>
        agent.id === updatedAgent.id ? { ...agent, ...updatedAgent } : agent
      )
    })
  }, [])

  return (
    <AgentContext.Provider value={{ agents, updateAgent, refreshAgents, clickAgent }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgents() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error("useAgents must be used within an AgentProvider")
  }

  return context
}
