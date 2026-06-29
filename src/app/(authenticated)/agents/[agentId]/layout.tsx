import { AgentRouteShell } from "@/components/AgentRouteShell";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <AgentRouteShell>{children}</AgentRouteShell>;
}
