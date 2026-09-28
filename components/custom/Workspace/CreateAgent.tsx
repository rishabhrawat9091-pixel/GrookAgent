"use client"

import { useState } from "react"
import { ArrowLeft, Bot, Shuffle } from "lucide-react"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

const botDesigns = ["market-scout", "research-orbit", "studio-spark", "signal-guide", "growth-pilot"]

const botImage = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}&backgroundColor=f5f5f4,e0f2fe,dcfce7,fae8ff&radius=50`

export function CreateAgent() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [instructions, setInstructions] = useState("")
  const [designIndex, setDesignIndex] = useState(0)
  const selectedDesign = botDesigns[designIndex]

  const saveAgent = (event: any) => {
    event.preventDefault()
    console.log(name, instructions, designIndex)
    if (!name.trim()) return
    router.push("/workspace")
  }

  return (
    <div className="min-h-dvh bg-zinc-50 px-6 py-8">
      <div className="mx-auto w-full max-w-xl">

        <form className="mt-2 border-y border-zinc-200 bg-white px-7 py-8 sm:rounded-lg sm:border sm:shadow-sm" onSubmit={saveAgent}>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Create new agent</h1>
            <p className="mt-1.5 text-sm text-zinc-500">Set up a focused assistant for a specific piece of work.</p>
          </div>

          <div className="mt-8 flex flex-col items-center border-y border-zinc-100 py-6">
            <Avatar className="size-24 border-2 border-zinc-100" size="lg">
              <AvatarImage alt="Selected bot design" src={botImage(selectedDesign)} />
              <AvatarFallback className="bg-zinc-100 text-zinc-600"><Bot className="size-9" /></AvatarFallback>
            </Avatar>
            <button className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900" onClick={() => setDesignIndex((index) => (index + 1) % botDesigns.length)} type="button">
              <Shuffle className="size-3.5" />
              Shuffle design
            </button>
          </div>

          <div className="mt-7 space-y-5">
            <label className="block text-sm font-medium text-zinc-700">
              Bot name
              <input className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-3 focus:ring-zinc-100" onChange={(event) => setName(event.target.value)} placeholder="e.g. Pulse" required value={name} />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Instructions
              <textarea className="mt-1.5 min-h-32 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-5 text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-3 focus:ring-zinc-100" onChange={(event) => setInstructions(event.target.value)} placeholder="What should this agent help you accomplish?" value={instructions} />
            </label>
          </div>

          <div className="mt-8 flex justify-end gap-2">
            <Button onClick={() => router.push("/workspace")} type="button" variant="outline">Cancel</Button>
            <Button type="submit">Save agent</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
