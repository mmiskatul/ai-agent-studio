import { primeSessionCache } from "@/lib/session-cache";
import type { Agent, AgentResponsePage, MemorySummary, Message } from "@/lib/agent-api";

export type CachedWorkspaceSnapshot = {
  agent: Agent;
  pages: AgentResponsePage[];
  activePageId: string | null;
  messages: Message[];
  memorySummary: MemorySummary;
  hasMoreMessages: boolean;
  totalMessageCount: number;
};

export const WORKSPACE_SNAPSHOT_TTL_MS = 20_000;

export function getWorkspaceSnapshotCacheKey(agentId: string, chatId: string | null) {
  return `chat-workspace:${agentId}:${chatId || "latest"}`;
}

export function primeWorkspaceSnapshot(
  agent: Agent,
  pages: AgentResponsePage[],
  activePageId: string | null,
  messages: Message[],
  memorySummary: MemorySummary,
  hasMoreMessages: boolean,
  totalMessageCount: number,
) {
  primeSessionCache(
    getWorkspaceSnapshotCacheKey(agent.id, activePageId),
    {
      agent,
      pages,
      activePageId,
      messages,
      memorySummary,
      hasMoreMessages,
      totalMessageCount,
    } satisfies CachedWorkspaceSnapshot,
    WORKSPACE_SNAPSHOT_TTL_MS,
  );
}
