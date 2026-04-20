export interface Agent {
  id: string;
  name: string;
  role: string;
  purpose: string;
  template_type: string | null;
  system_prompt: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type AgentInsert = Omit<Agent, "id" | "created_at" | "updated_at">;
export type AgentUpdate = Partial<AgentInsert>;

export interface Chat {
  id: string;
  agent_id: string;
  created_at: string;
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

export async function fetchAgents() {
  return readCollection<Agent>(AGENTS_STORAGE_KEY).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
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

      if (!agent || !lastMessage) return null;

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
