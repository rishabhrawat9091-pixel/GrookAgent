import { AppSidebar } from "@/components/custom/Workspace/Appsidebar"

const WorkspaceLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-dvh bg-zinc-50">
      <AppSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}

export default WorkspaceLayout
