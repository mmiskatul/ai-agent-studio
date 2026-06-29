export const AUTHENTICATED_HOME = "/dashboard" as const;
export const AGENTS_ROUTE = "/agents" as const;
export const CHATS_ROUTE = "/chats" as const;
export const SIGN_IN_ROUTE = "/login" as const;

export function buildAgentRoute(agentId: string) {
  return `${AGENTS_ROUTE}/${agentId}`;
}

export function buildAgentChatRoute(
  agentId: string,
  agentName?: string | null,
  chatId?: string | null,
) {
  const params = new URLSearchParams();

  if (chatId?.trim()) {
    params.set("chatId", chatId);
  }

  if (agentName?.trim()) {
    params.set("name", agentName);
  }

  const query = params.toString();
  return query ? `${buildAgentRoute(agentId)}/chat?${query}` : `${buildAgentRoute(agentId)}/chat`;
}
