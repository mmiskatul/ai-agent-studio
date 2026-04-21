export interface Agent {
  id: string;
  _id?: string;
  name: string;
  role: string;
  purpose: string;
  description?: string | null;
  template_type: string | null;
  system_prompt: string;
  welcome_message?: string | null;
  status: string;
  queries_30d?: number;
  tools?: string[];
  model?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentInsert = Omit<Agent, "id" | "queries_30d" | "created_at" | "updated_at">;
export type AgentUpdate = Partial<AgentInsert>;

export interface Chat {
  id: string;
  _id?: string;
  agent_id: string;
  title?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_type: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatAgent {
  agent: Agent;
  chat: Chat;
  last_message: Message;
  message_count: number;
}

const AGENTS_STORAGE_KEY = "agenthub.agents";
const CHATS_STORAGE_KEY = "agenthub.chats";
const MESSAGES_STORAGE_KEY = "agenthub.messages";

function requireBrowserStorage() {
  if (typeof window === "undefined") {
    throw new Error("Local frontend storage is only available in the browser");
  }
}

function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

function readCollection<T>(key: string): T[] {
  requireBrowserStorage();

  const raw = window.localStorage.getItem(key);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as T[];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function writeCollection<T>(key: string, value: T[]) {
  requireBrowserStorage();
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeAgent(agent: Agent) {
  return {
    ...agent,
    id: agent.id || agent._id || "",
  };
}

function normalizeChat(chat: Chat) {
  return {
    ...chat,
    id: chat.id || chat._id || "",
  };
}

export function isAgentActive(agent: Agent) {
  return agent.status === "active" && agent.is_active !== false;
}

export async function fetchAgents() {
  return readCollection<Agent>(AGENTS_STORAGE_KEY).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

async function fetchBackendAgentsRequest(accessToken: string) {
  const response = await fetch("/backend/api/v1/agents", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to load agents");
  }

  return (body as Agent[]).map(normalizeAgent).filter((agent) => agent.id);
}

async function withBackendAuthRetry<T>(
  request: (accessToken: string) => Promise<T>,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  try {
    return await request(accessToken);
  } catch (error) {
    if (!(error instanceof Error) || !refreshAccessToken) {
      throw error;
    }

    const message = error.message.toLowerCase();
    const isUnauthorized =
      message.includes("invalid bearer token") ||
      message.includes("missing bearer token") ||
      message.includes("unauthorized");

    if (!isUnauthorized) {
      throw error;
    }

    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      throw error;
    }

    return request(refreshedToken);
  }
}

export async function fetchBackendAgents(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(fetchBackendAgentsRequest, accessToken, refreshAccessToken);
}

async function fetchBackendAgentRequest(agentId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to load agent");
  }

  return normalizeAgent(body as Agent);
}

export async function fetchBackendAgent(
  agentId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => fetchBackendAgentRequest(agentId, token),
    accessToken,
    refreshAccessToken,
  );
}

async function updateBackendAgentRequest(
  agentId: string,
  updates: AgentUpdate,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(updates),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to update agent");
  }

  return body as Agent;
}

export async function updateBackendAgent(
  agentId: string,
  updates: AgentUpdate,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => updateBackendAgentRequest(agentId, updates, token),
    accessToken,
    refreshAccessToken,
  );
}

async function deleteBackendAgentRequest(agentId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to delete agent");
  }
}

export async function deleteBackendAgent(
  agentId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => deleteBackendAgentRequest(agentId, token),
    accessToken,
    refreshAccessToken,
  );
}

async function fetchBackendChatsRequest(agentId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chats`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to load chats");
  }

  return (body as Chat[]).map(normalizeChat).filter((chat) => chat.id);
}

export async function fetchBackendChats(
  agentId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => fetchBackendChatsRequest(agentId, token),
    accessToken,
    refreshAccessToken,
  );
}

async function createBackendChatRequest(agentId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chats`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to create chat");
  }

  return normalizeChat(body as Chat);
}

export async function createBackendChat(
  agentId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => createBackendChatRequest(agentId, token),
    accessToken,
    refreshAccessToken,
  );
}

async function deleteBackendChatRequest(agentId: string, chatId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chats/${chatId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to delete chat");
  }
}

export async function deleteBackendChat(
  agentId: string,
  chatId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => deleteBackendChatRequest(agentId, chatId, token),
    accessToken,
    refreshAccessToken,
  );
}

async function fetchBackendMessagesRequest(agentId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chat/messages`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to load messages");
  }

  return body as Message[];
}

async function fetchBackendChatMessagesRequest(
  agentId: string,
  chatId: string,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chats/${chatId}/messages`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to load messages");
  }

  return body as Message[];
}

export async function fetchBackendChatMessages(
  agentId: string,
  chatId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => fetchBackendChatMessagesRequest(agentId, chatId, token),
    accessToken,
    refreshAccessToken,
  );
}

export async function fetchBackendMessages(
  agentId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => fetchBackendMessagesRequest(agentId, token),
    accessToken,
    refreshAccessToken,
  );
}

async function sendBackendMessageRequest(agentId: string, content: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chat/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to send message");
  }

  return body as {
    user_message: Message;
    assistant_message: Message;
  };
}

export async function sendBackendMessage(
  agentId: string,
  content: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => sendBackendMessageRequest(agentId, content, token),
    accessToken,
    refreshAccessToken,
  );
}

async function sendBackendChatMessageRequest(
  agentId: string,
  chatId: string,
  content: string,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chats/${chatId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to send message");
  }

  return body as {
    user_message: Message;
    assistant_message: Message;
  };
}

export async function sendBackendChatMessage(
  agentId: string,
  chatId: string,
  content: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => sendBackendChatMessageRequest(agentId, chatId, content, token),
    accessToken,
    refreshAccessToken,
  );
}

async function updateBackendMessageRequest(
  agentId: string,
  messageId: string,
  content: string,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chat/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to update message");
  }

  return body as {
    user_message: Message;
    assistant_message: Message;
  };
}

export async function updateBackendMessage(
  agentId: string,
  messageId: string,
  content: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => updateBackendMessageRequest(agentId, messageId, content, token),
    accessToken,
    refreshAccessToken,
  );
}

async function updateBackendChatMessageRequest(
  agentId: string,
  chatId: string,
  messageId: string,
  content: string,
  accessToken: string,
) {
  const response = await fetch(
    `/backend/api/v1/agents/${agentId}/chats/${chatId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ content }),
    },
  );

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to update message");
  }

  return body as {
    user_message: Message;
    assistant_message: Message;
  };
}

export async function updateBackendChatMessage(
  agentId: string,
  chatId: string,
  messageId: string,
  content: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => updateBackendChatMessageRequest(agentId, chatId, messageId, content, token),
    accessToken,
    refreshAccessToken,
  );
}

async function deleteBackendMessageRequest(
  agentId: string,
  messageId: string,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chat/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to delete message");
  }
}

export async function deleteBackendMessage(
  agentId: string,
  messageId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => deleteBackendMessageRequest(agentId, messageId, token),
    accessToken,
    refreshAccessToken,
  );
}

async function deleteBackendChatMessageRequest(
  agentId: string,
  chatId: string,
  messageId: string,
  accessToken: string,
) {
  const response = await fetch(
    `/backend/api/v1/agents/${agentId}/chats/${chatId}/messages/${messageId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to delete message");
  }
}

export async function deleteBackendChatMessage(
  agentId: string,
  chatId: string,
  messageId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => deleteBackendChatMessageRequest(agentId, chatId, messageId, token),
    accessToken,
    refreshAccessToken,
  );
}

export async function fetchAgent(id: string) {
  const agent = readCollection<Agent>(AGENTS_STORAGE_KEY).find((agent) => agent.id === id);
  if (!agent) throw new Error("Agent not found");
  return agent;
}

export async function fetchAgentQueryCounts(days = 30) {
  const chats = readCollection<Chat>(CHATS_STORAGE_KEY);
  const messages = readCollection<Message>(MESSAGES_STORAGE_KEY);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const chatAgentMap = new Map(chats.map((chat) => [chat.id, chat.agent_id]));

  return messages.reduce<Record<string, number>>((counts, message) => {
    if (message.sender_type !== "user") return counts;

    const createdAt = new Date(message.created_at).getTime();
    if (!Number.isFinite(createdAt) || createdAt < since) return counts;

    const agentId = chatAgentMap.get(message.chat_id);
    if (!agentId) return counts;

    counts[agentId] = (counts[agentId] ?? 0) + 1;
    return counts;
  }, {});
}

export async function createAgent(agent: AgentInsert) {
  const agents = readCollection<Agent>(AGENTS_STORAGE_KEY);
  const now = new Date().toISOString();
  const created: Agent = {
    ...agent,
    id: createId("agent"),
    template_type: agent.template_type || null,
    created_at: now,
    updated_at: now,
  };

  writeCollection(AGENTS_STORAGE_KEY, [created, ...agents]);
  return created;
}

export async function updateAgent(id: string, updates: AgentUpdate) {
  const agents = readCollection<Agent>(AGENTS_STORAGE_KEY);
  const index = agents.findIndex((agent) => agent.id === id);
  if (index === -1) throw new Error("Agent not found");

  const updated = {
    ...agents[index],
    ...updates,
    template_type: updates.template_type ?? agents[index].template_type,
    updated_at: new Date().toISOString(),
  };

  agents[index] = updated;
  writeCollection(AGENTS_STORAGE_KEY, agents);
  return updated;
}

export async function deleteAgent(id: string) {
  writeCollection(
    AGENTS_STORAGE_KEY,
    readCollection<Agent>(AGENTS_STORAGE_KEY).filter((agent) => agent.id !== id),
  );

  const chats = readCollection<Chat>(CHATS_STORAGE_KEY);
  const deletedChatIds = new Set(
    chats.filter((chat) => chat.agent_id === id).map((chat) => chat.id),
  );

  writeCollection(
    CHATS_STORAGE_KEY,
    chats.filter((chat) => chat.agent_id !== id),
  );
  writeCollection(
    MESSAGES_STORAGE_KEY,
    readCollection<Message>(MESSAGES_STORAGE_KEY).filter(
      (message) => !deletedChatIds.has(message.chat_id),
    ),
  );
}

export async function getOrCreateChat(agentId: string) {
  const chats = readCollection<Chat>(CHATS_STORAGE_KEY);
  const existing = chats.find((chat) => chat.agent_id === agentId);

  if (existing) return existing;

  const chat = {
    id: createId("chat"),
    agent_id: agentId,
    created_at: new Date().toISOString(),
  };

  writeCollection(CHATS_STORAGE_KEY, [chat, ...chats]);
  return chat;
}

export async function fetchMessages(chatId: string) {
  return readCollection<Message>(MESSAGES_STORAGE_KEY)
    .filter((message) => message.chat_id === chatId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function fetchChatAgents() {
  const agents = readCollection<Agent>(AGENTS_STORAGE_KEY);
  const chats = readCollection<Chat>(CHATS_STORAGE_KEY);
  const messages = readCollection<Message>(MESSAGES_STORAGE_KEY);

  return chats
    .map((chat) => {
      const agent = agents.find((item) => item.id === chat.agent_id);
      const chatMessages = messages
        .filter((message) => message.chat_id === chat.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const lastMessage = chatMessages.at(-1);

      if (!agent || !isAgentActive(agent) || !lastMessage) return null;

      return {
        agent,
        chat,
        last_message: lastMessage,
        message_count: chatMessages.length,
      };
    })
    .filter((item): item is ChatAgent => item !== null)
    .sort((a, b) => b.last_message.created_at.localeCompare(a.last_message.created_at));
}

export async function addMessage(
  chatId: string,
  senderType: "user" | "assistant",
  content: string,
) {
  const messages = readCollection<Message>(MESSAGES_STORAGE_KEY);
  const message = {
    id: createId("message"),
    chat_id: chatId,
    sender_type: senderType,
    content,
    created_at: new Date().toISOString(),
  };

  writeCollection(MESSAGES_STORAGE_KEY, [...messages, message]);
  return message;
}
