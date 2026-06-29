import { AgentChatWorkspace } from "@/components/AgentChatWorkspace";

type AgentChatPageProps = {
  params: Promise<{ agentId: string }>;
};

export default async function AgentChatPage({ params }: AgentChatPageProps) {
  const { agentId } = await params;
  return <AgentChatWorkspace routeAgentId={agentId} />;
}
