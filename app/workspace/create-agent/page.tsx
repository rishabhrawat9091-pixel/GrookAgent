"use client"

import { FormEvent, useState } from "react"
import { ArrowLeft, Bot, Shuffle } from "lucide-react"
import { useRouter } from "next/navigation"
import axios from "axios"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAgents } from "@/context/AgentContext"

const botDesigns = ["market-scout", "research-orbit", "studio-spark", "signal-guide", "growth-pilot"]
const botImage = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff&radius=50`

export default function CreateAgentPage() {
  const router = useRouter()
  const { refreshAgents } = useAgents()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [designIndex, setDesignIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const image = botImage(botDesigns[designIndex])

  const createAgent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !description.trim() || isSaving) return

    setIsSaving(true)
    setError("")
    const agentId = crypto.randomUUID()

    try {
      await axios.post("/api/agent", {
        agentId,
        name: name.trim(),
        description: description.trim(),
        agentImage: image,
      })

      await refreshAgents()
      router.push(`/workspace/agent/${agentId}`)
    } catch {
      setError("Unable to create the agent. Please try again.")
      setIsSaving(false)
    }
  }

  return (
    <main className="h-dvh overflow-hidden bg-[#f8faf9] px-5 py-4 sm:px-8">
      <div className="mx-auto w-full max-w-xl">
        <form className="mt-16 border border-zinc-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={createAgent}>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Create new agent</h1>
            <p className="mt-1.5 text-sm text-zinc-500">Set up a focused assistant for a specific piece of work.</p>
          </div>
          <div className="mt-5 flex flex-col items-center border-y border-zinc-100 py-4">
            <Avatar className="size-20 border-2 border-zinc-100" size="lg">
              <AvatarImage alt="Selected bot design" src={image} />
              <AvatarFallback className="bg-zinc-100 text-zinc-600">
                <Bot className="size-8" />
              </AvatarFallback>
            </Avatar>
            <button
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              onClick={() => setDesignIndex((index) => (index + 1) % botDesigns.length)}
              type="button"
            >
              <Shuffle className="size-3.5" /> Shuffle image
            </button>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-zinc-700">
              Bot name
              <input
                className="mt-1.5 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-600 focus:ring-3 focus:ring-teal-100"
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Pulse"
                required
                value={name}
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Description
              <textarea
                className="mt-1.5 min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-5 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-600 focus:ring-3 focus:ring-teal-100"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What should this agent help you accomplish?"
                required
                value={description}
              />
            </label>
          </div>
          {error && <p className="mt-4 text-sm text-rose-700" role="alert">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => router.push("/workspace")} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-teal-700 hover:bg-teal-800" disabled={isSaving} type="submit">
              {isSaving ? "Creating..." : "Create agent"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
