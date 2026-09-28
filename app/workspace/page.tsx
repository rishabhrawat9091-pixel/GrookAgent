import { ArrowUpRight, Bot, MoreHorizontal } from "lucide-react"

const WorkspacePage = () => {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div>
          <p className="text-sm font-medium text-zinc-900">Good morning, Avery</p>
          <p className="mt-0.5 text-xs text-zinc-500">Choose an agent to continue your work.</p>
        </div>
        <button className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900" type="button" aria-label="More options">
          <MoreHorizontal className="size-4" />
        </button>
      </header>
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm">
            <Bot className="size-5" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900">Your team is ready</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Select an agent from the sidebar, or create a new one to start a focused conversation.</p>
          <button className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900" type="button">
            View recent activity
            <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      </section>
    </div>
  )
}

export default WorkspacePage
