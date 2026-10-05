import { AppSidebar } from "@/components/custom/Workspace/Appsidebar"
import { AgentProvider } from "@/context/AgentContext"

const WorkspaceLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AgentProvider>
      <div className="flex min-h-dvh bg-zinc-50">
        <AppSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AgentProvider>
  )
}

export default WorkspaceLayout

