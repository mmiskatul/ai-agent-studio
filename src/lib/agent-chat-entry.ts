import {
  BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY,
  type Agent,
  type AgentResponsePage,
  type MemorySummary,
} from "@/lib/agent-api";
import { primeWorkspaceSnapshot } from "@/lib/chat-workspace-cache";
import { peekSessionCache } from "@/lib/session-cache";

type AgentSummaryLike = {
  id: string;
  name: string;
  role: string;
  status: "enabled" | "disabled";
  category?: string | null;
};

function createEmptyMemorySummary(): MemorySummary {
  return {
    title: "",
    description: "",
  };
}

export function getCachedAgentChatPages(agentId: string) {
  const cachedPages =
    peekSessionCache<AgentResponsePage[]>(BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY, {
      allowExpired: true,
    }) ?? [];

  return cachedPages.filter((page) => page.agent_id === agentId);
}

export function getCachedAgentLatestChatId(agentId: string) {
  return getCachedAgentChatPages(agentId)[0]?.id ?? null;
}

export function createAgentSnapshotFromSummary(agent: AgentSummaryLike): Agent {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    purpose: "",
    description: "",
    knowledge_text: null,
    language: "EN",
    template_type: agent.category || null,
    template_id: null,
    category_tag: agent.category || null,
    system_prompt: "",
    welcome_message: null,
    llm_engine: "gpt-4o",
    status: agent.status,
    created_at: "",
    updated_at: "",
  };
}

export function primeAgentChatEntrySnapshot(agent: Agent) {
  const agentPages = getCachedAgentChatPages(agent.id);
  const recentPage = agentPages[0] ?? null;

  primeWorkspaceSnapshot(
    agent,
    agentPages,
    recentPage?.id ?? null,
    [],
    recentPage?.memory_summary ?? createEmptyMemorySummary(),
    false,
    recentPage?.message_count ?? 0,
  );
}
