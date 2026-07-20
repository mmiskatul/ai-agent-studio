import { ApiRequestError, getApiErrorMessage, getApiSuccessData } from "@/lib/error-message";
import { withUnauthorizedRetry } from "@/lib/backend-auth";
import { backendFetch } from "@/lib/backend-fetch";
import { DASHBOARD_OVERVIEW_CACHE_KEY } from "@/lib/dashboard-api";
import {
  getOrFetchSessionCached,
  invalidateSessionCache,
  invalidateSessionCacheByPrefix,
  peekSessionCache,
  primeSessionCache,
} from "@/lib/session-cache";

const fetch = backendFetch;

export interface Agent {
  id: string;
  _id?: string;
  name: string;
  role: string;
  purpose: string;
  description?: string | null;
  knowledge_text?: string | null;
  language: "EN" | "DE" | "RU";
  template_type: string | null;
  template_id?: string | null;
  category_tag: string | null;
  system_prompt: string;
  welcome_message?: string | null;
  llm_engine: string;
  status: "enabled" | "disabled";
  owner_user_id?: string;
  user_id?: string;
  queries_30d?: number;
  tools?: string[];
  model?: string | null;
  temperature?: number;
  routing_keywords?: string[];
  priority?: number;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentInsert {
  name: string;
  role: string;
  purpose: string;
  description?: string | null;
  knowledge_text?: string | null;
  language: "EN" | "DE" | "RU";
  template_type?: string | null;
  template_id?: string | null;
  category_tag?: string | null;
  system_prompt: string;
  welcome_message?: string | null;
  llm_engine?: string;
  model?: string | null;
  temperature?: number;
  status?: "enabled" | "disabled";
  tools?: string[];
  routing_keywords?: string[];
  priority?: number;
  is_active?: boolean;
}
export type AgentUpdate = Partial<AgentInsert>;

export interface AgentKnowledgeUploadResult {
  file_name: string;
  content_type: string;
  extracted_text: string;
  character_count: number;
}

interface AgentKnowledgeUploadJob {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  file_name: string;
  content_type: string;
  extracted_text?: string | null;
  character_count: number;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  _id?: string;
  agent_id: string;
  current_agent_id?: string | null;
  session_id?: string | null;
  title?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_type: "user" | "assistant";
  role?: "user" | "assistant";
  agent_id?: string | null;
  session_id?: string | null;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface ChatAgent {
  agent: Agent;
  chat: Chat;
  last_message: Message;
  message_count: number;
}

export interface MemorySummary {
  title: string;
  description: string;
}

export interface AgentResponsePage {
  id: string;
  agent_id: string;
  agent_name?: string | null;
  title?: string | null;
  memory_summary: MemorySummary;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface StructuredChatResponse {
  session_id: string;
  chat_id: string;
  agent: {
    id: string;
    name: string;
    role: string;
  };
  system_summary: string;
  response: string;
  markdown: string;
  render_mode: string;
  routing_reason: string;
  memory_updated: boolean;
  metadata: {
    model?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

export interface AgentResponseGenerateResult {
  agent_id: string;
  agent_name: string;
  chat_id: string;
  content: string;
  memory_summary: MemorySummary;
  structured_response?: StructuredChatResponse;
  local_fallback?: boolean;
}

export interface AgentResponseWorkspace {
  agent: Agent;
  chat_id: string | null;
  memory_summary: MemorySummary;
  messages: Message[];
  total_message_count: number;
  has_more_messages: boolean;
  pages: AgentResponsePage[];
}

const AGENTS_STORAGE_KEY = "agenthub.agents";
const CHATS_STORAGE_KEY = "agenthub.chats";
const MESSAGES_STORAGE_KEY = "agenthub.messages";
export const BACKEND_AGENTS_CACHE_KEY = "backend-agents";
export const BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY = "backend-all-agent-response-pages";
const BACKEND_AGENTS_CACHE_TTL_MS = 45_000;
const BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_TTL_MS = 20_000;
const BACKEND_AGENT_RESPONSE_PAGES_CACHE_TTL_MS = 20_000;
const BACKEND_AGENT_RESPONSE_WORKSPACE_CACHE_TTL_MS = 20_000;

function backendAgentCacheKey(agentId: string) {
  return `backend-agent:${agentId}`;
}

function backendAgentResponsePagesCacheKey(agentId: string) {
  return `backend-agent-response-pages:${agentId}`;
}

function backendAgentResponseWorkspaceCacheKey(agentId: string, chatId: string | null) {
  return `backend-agent-response-workspace:${agentId}:${chatId || "latest"}`;
}

function backendAgentResponseWorkspacePrefix(agentId: string) {
  return `backend-agent-response-workspace:${agentId}:`;
}

function mergeAgentIntoList(agent: Agent) {
  const cachedAgents = peekSessionCache<Agent[]>(BACKEND_AGENTS_CACHE_KEY, { allowExpired: true }) ?? [];
  const nextAgents = [agent, ...cachedAgents.filter((item) => item.id !== agent.id)].sort((left, right) =>
    (right.updated_at || right.created_at).localeCompare(left.updated_at || left.created_at),
  );
  primeSessionCache(BACKEND_AGENTS_CACHE_KEY, nextAgents, BACKEND_AGENTS_CACHE_TTL_MS);
}

function removeAgentFromList(agentId: string) {
  const cachedAgents = peekSessionCache<Agent[]>(BACKEND_AGENTS_CACHE_KEY, { allowExpired: true });
  if (!cachedAgents) {
    return;
  }
  primeSessionCache(
    BACKEND_AGENTS_CACHE_KEY,
    cachedAgents.filter((item) => item.id !== agentId),
    BACKEND_AGENTS_CACHE_TTL_MS,
  );
}

function invalidateBackendAgentCaches(agentId?: string) {
  const keys = [
    BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY,
    DASHBOARD_OVERVIEW_CACHE_KEY,
  ];
  if (agentId) {
    keys.push(backendAgentCacheKey(agentId));
  }
  invalidateSessionCache(keys);
  if (agentId) {
    invalidateSessionCache(backendAgentResponsePagesCacheKey(agentId));
    invalidateSessionCacheByPrefix(backendAgentResponseWorkspacePrefix(agentId));
  } else {
    invalidateSessionCache(BACKEND_AGENTS_CACHE_KEY);
    invalidateSessionCacheByPrefix("backend-agent-response-workspace:");
  }
}

function invalidateBackendAgentResponseCaches(agentId: string, chatId?: string | null) {
  invalidateSessionCache([
    BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY,
    backendAgentResponsePagesCacheKey(agentId),
    DASHBOARD_OVERVIEW_CACHE_KEY,
  ]);

  if (chatId) {
    invalidateSessionCache(backendAgentResponseWorkspaceCacheKey(agentId, chatId));
  }
  invalidateSessionCache(backendAgentResponseWorkspaceCacheKey(agentId, null));
}

function primeBackendAgentResponseWorkspaceCache(workspace: AgentResponseWorkspace) {
  primeSessionCache(
    backendAgentResponseWorkspaceCacheKey(workspace.agent.id, workspace.chat_id),
    workspace,
    BACKEND_AGENT_RESPONSE_WORKSPACE_CACHE_TTL_MS,
  );

  if (workspace.chat_id) {
    primeSessionCache(
      backendAgentResponseWorkspaceCacheKey(workspace.agent.id, null),
      workspace,
      BACKEND_AGENT_RESPONSE_WORKSPACE_CACHE_TTL_MS,
    );
  }
}

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

export function normalizeAgent(agent: Agent) {
  return {
    ...agent,
    id: agent.id || agent._id || "",
    purpose: agent.purpose || agent.description || "",
    description: agent.description || agent.purpose || "",
    language: agent.language || "EN",
    template_type: agent.template_type || null,
    template_id: agent.template_id || null,
    status: agent.status || (agent.is_active === false ? "disabled" : "enabled"),
    owner_user_id: agent.owner_user_id || agent.user_id || "",
  };
}

function normalizeChat(chat: Chat) {
  return {
    ...chat,
    id: chat.id || chat._id || "",
    agent_id: chat.agent_id || chat.current_agent_id || "",
  };
}

function normalizeMessage(message: Message) {
  const senderType = message.sender_type || message.role || "assistant";
  return {
    ...message,
    id: message.id || (message as Message & { _id?: string })._id || "",
    sender_type: senderType,
    role: senderType,
    content:
      senderType === "assistant" ? normalizeAgentResponseContent(message.content) : message.content,
  } as Message;
}

function sessionIdForAgent(agentId: string) {
  return `agent_${agentId}`;
}

function buildLocalAgentFallback(agentId: string, content: string, chatId: string | null) {
  return {
    agent_id: agentId,
    agent_name: "",
    chat_id: chatId || "pending",
    content:
      "I could not reach the configured AI provider for this request, so I am showing a local fallback instead.\n\n" +
      `Your message: ${content}\n\n` +
      "Please check the backend provider configuration, then try again.",
    memory_summary: normalizeMemorySummary("Local fallback response"),
    local_fallback: true,
  } satisfies AgentResponseGenerateResult;
}

function normalizeAgentResponseContent(content: string) {
  const trimmedContent = content.trim();
  if (!trimmedContent.startsWith("{")) return content;

  try {
    const parsed = JSON.parse(trimmedContent) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "response" in parsed &&
      typeof parsed.response === "string"
    ) {
      return parsed.response;
    }
  } catch {
    return content;
  }

  return content;
}

function normalizeMemorySummary(summary: unknown): MemorySummary {
  if (summary && typeof summary === "object") {
    const parsed = summary as { title?: unknown; description?: unknown };
    return {
      title: typeof parsed.title === "string" ? parsed.title.trim() : "",
      description: typeof parsed.description === "string" ? parsed.description.trim() : "",
    };
  }

  if (typeof summary === "string") {
    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      return { title: "", description: "" };
    }

    if (trimmedSummary.startsWith("{")) {
      try {
        return normalizeMemorySummary(JSON.parse(trimmedSummary) as unknown);
      } catch {
        return { title: "", description: trimmedSummary };
      }
    }

    return { title: "", description: trimmedSummary };
  }

  return { title: "", description: "" };
}

function normalizeBackendAgentResponseHistory(body: unknown) {
  const parsedBody = body as {
    agent_id: string;
    agent_name: string;
    chat_id: string | null;
    memory_summary: unknown;
    messages: Message[];
    total_message_count?: number;
    has_more_messages?: boolean;
  };

  return {
    ...parsedBody,
    memory_summary: normalizeMemorySummary(parsedBody.memory_summary),
    messages: parsedBody.messages.map(normalizeMessage),
    total_message_count: parsedBody.total_message_count ?? parsedBody.messages.length,
    has_more_messages: Boolean(parsedBody.has_more_messages),
  };
}

function normalizeStructuredHistory(agentId: string, chatId: string | null, body: unknown) {
  const parsedBody = body as {
    session_id: string;
    chats: Chat[];
    messages: Message[];
  };
  const chats = (parsedBody.chats || []).map(normalizeChat);
  const selectedChat =
    (chatId ? chats.find((chat) => chat.id === chatId) : null) || chats[0] || null;
  const selectedChatId = selectedChat?.id || chatId || null;
  const messages = (parsedBody.messages || [])
    .map(normalizeMessage)
    .filter((message) => !selectedChatId || message.chat_id === selectedChatId);

  return {
    agent_id: selectedChat?.agent_id || agentId,
    agent_name: "",
    chat_id: selectedChatId,
    memory_summary: normalizeMemorySummary(selectedChat?.title || ""),
    messages,
  };
}

export function isAgentActive(agent: Agent) {
  return agent.status === "enabled" && agent.is_active !== false;
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
    throw new Error(getApiErrorMessage(body, "Failed to load agents"));
  }

  return (body as Agent[]).map(normalizeAgent).filter((agent) => agent.id);
}

async function withBackendAuthRetry<T>(
  request: (accessToken: string) => Promise<T>,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withUnauthorizedRetry(request, accessToken, refreshAccessToken);
}

export async function fetchBackendAgents(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return getOrFetchSessionCached(BACKEND_AGENTS_CACHE_KEY, BACKEND_AGENTS_CACHE_TTL_MS, () =>
    withBackendAuthRetry(fetchBackendAgentsRequest, accessToken, refreshAccessToken),
  );
}

async function uploadAgentKnowledgeFileRequest(file: File, accessToken: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/backend/api/v1/agents/knowledge/extract-jobs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiRequestError(getApiErrorMessage(body, "Failed to extract uploaded knowledge"), {
      detail: body,
      status: response.status,
    });
  }

  return body as AgentKnowledgeUploadJob;
}

async function fetchAgentKnowledgeUploadJobRequest(jobId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/knowledge/extract-jobs/${jobId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiRequestError(getApiErrorMessage(body, "Failed to check uploaded knowledge"), {
      detail: body,
      status: response.status,
    });
  }

  return body as AgentKnowledgeUploadJob;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAgentKnowledgeUploadJob(
  jobId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const maxAttempts = 60;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const job = await withBackendAuthRetry(
      (token) => fetchAgentKnowledgeUploadJobRequest(jobId, token),
      accessToken,
      refreshAccessToken,
    );

    if (job.status === "completed" && job.extracted_text) {
      return {
        file_name: job.file_name,
        content_type: job.content_type,
        extracted_text: job.extracted_text,
        character_count: job.character_count,
      } satisfies AgentKnowledgeUploadResult;
    }

    if (job.status === "failed") {
      throw new Error(job.error?.trim() || "Failed to extract uploaded knowledge");
    }

    await delay(1000);
  }

  throw new Error("Knowledge extraction is taking too long. Please try again.");
}

export async function uploadAgentKnowledgeFile(
  file: File,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File is too large. Knowledge uploads must be 5 MB or smaller.");
  }

  const job = await withBackendAuthRetry(
    (token) => uploadAgentKnowledgeFileRequest(file, token),
    accessToken,
    refreshAccessToken,
  );
  return waitForAgentKnowledgeUploadJob(job.job_id, accessToken, refreshAccessToken);
}

async function createBackendAgentRequest(agent: AgentInsert, accessToken: string) {
  const response = await fetch("/backend/api/v1/agents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(agent),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiRequestError(getApiErrorMessage(body, "Failed to create agent"), {
      detail: body,
      status: response.status,
    });
  }

  return normalizeAgent(getApiSuccessData<Agent>(body));
}

export async function createBackendAgent(
  agent: AgentInsert,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const createdAgent = await withBackendAuthRetry(
    (token) => createBackendAgentRequest(agent, token),
    accessToken,
    refreshAccessToken,
  );
  primeSessionCache(backendAgentCacheKey(createdAgent.id), createdAgent, BACKEND_AGENTS_CACHE_TTL_MS);
  mergeAgentIntoList(createdAgent);
  invalidateSessionCache([BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY, DASHBOARD_OVERVIEW_CACHE_KEY]);
  return createdAgent;
}

async function fetchBackendAgentRequest(agentId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiRequestError(getApiErrorMessage(body, "Failed to load agent"), {
      detail: body,
      status: response.status,
    });
  }

  return normalizeAgent(body as Agent);
}

export async function fetchBackendAgent(
  agentId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return getOrFetchSessionCached(
    backendAgentCacheKey(agentId),
    BACKEND_AGENTS_CACHE_TTL_MS,
    () =>
      withBackendAuthRetry(
        (token) => fetchBackendAgentRequest(agentId, token),
        accessToken,
        refreshAccessToken,
      ),
  );
}

async function generateBackendAgentResponseRequest(
  agentId: string,
  content: string,
  chatId: string | null,
  attachmentText: string | null,
  attachmentName: string | null,
  accessToken: string,
): Promise<AgentResponseGenerateResult> {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/response`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      content,
      chat_id: chatId || undefined,
      attachment_text: attachmentText || undefined,
      attachment_name: attachmentName || undefined,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = typeof body.detail === "string" ? body.detail : "";
    if (detail.toLowerCase().includes("llm provider request failed")) {
      return buildLocalAgentFallback(agentId, content, chatId);
    }
    throw new Error(getApiErrorMessage(body, "Failed to generate agent response"));
  }

  const parsedBody = body as AgentResponseGenerateResult;

  return {
    agent_id: parsedBody.agent_id,
    agent_name: parsedBody.agent_name,
    chat_id: parsedBody.chat_id,
    content: normalizeAgentResponseContent(parsedBody.content || ""),
    memory_summary: normalizeMemorySummary(parsedBody.memory_summary),
  };
}

export async function generateBackendAgentResponse(
  agentId: string,
  content: string,
  chatId: string | null,
  attachmentText: string | null,
  attachmentName: string | null,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const generatedResponse = await withBackendAuthRetry(
    (token) =>
      generateBackendAgentResponseRequest(
        agentId,
        content,
        chatId,
        attachmentText,
        attachmentName,
        token,
      ),
    accessToken,
    refreshAccessToken,
  );
  invalidateBackendAgentResponseCaches(agentId, generatedResponse.chat_id);
  return generatedResponse;
}

async function fetchBackendAgentResponseHistoryRequest(
  agentId: string,
  chatId: string | null,
  accessToken: string,
) {
  const params = new URLSearchParams();
  if (chatId) {
    params.set("chat_id", chatId);
  }
  const query = params.toString();
  const response = await fetch(
    `/backend/api/v1/agents/${agentId}/response/history${query ? `?${query}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load chat history"));
  }

  return normalizeBackendAgentResponseHistory(body);
}

export async function fetchBackendAgentResponseHistory(
  agentId: string,
  chatId: string | null,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    (token) => fetchBackendAgentResponseHistoryRequest(agentId, chatId, token),
    accessToken,
    refreshAccessToken,
  );
}

async function fetchBackendAgentResponseWorkspaceRequest(
  agentId: string,
  chatId: string | null,
  accessToken: string,
) {
  const cachedWorkspaceSnapshot = peekSessionCache<AgentResponseWorkspace>(
    backendAgentResponseWorkspaceCacheKey(agentId, chatId),
    { allowExpired: true },
  );
  const cachedAgent =
    peekSessionCache<Agent>(backendAgentCacheKey(agentId), { allowExpired: true }) ??
    peekSessionCache<Agent[]>(BACKEND_AGENTS_CACHE_KEY, { allowExpired: true })?.find(
      (item) => item.id === agentId,
    ) ??
    cachedWorkspaceSnapshot?.agent ??
    null;
  const cachedAllPages = peekSessionCache<AgentResponsePage[]>(
    BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY,
    { allowExpired: true },
  );
  const cachedPages =
    cachedWorkspaceSnapshot?.pages ??
    cachedAllPages?.filter((page) => page.agent_id === agentId) ??
    [];

  const [agentResult, pagesResult, historyResult] = await Promise.allSettled([
    fetchBackendAgent(agentId, accessToken),
    fetchBackendAgentResponsePagesRequest(agentId, accessToken),
    fetchBackendAgentResponseHistoryRequest(agentId, chatId, accessToken),
  ]);

  const agent =
    agentResult.status === "fulfilled"
      ? agentResult.value
      : cachedAgent
        ? normalizeAgent(cachedAgent)
        : null;
  const pages =
    pagesResult.status === "fulfilled"
      ? pagesResult.value
      : [...cachedPages].sort((left, right) => {
          const leftTimestamp = left.updated_at || left.created_at;
          const rightTimestamp = right.updated_at || right.created_at;
          return rightTimestamp.localeCompare(leftTimestamp);
        });
  const history =
    historyResult.status === "fulfilled"
      ? historyResult.value
      : cachedWorkspaceSnapshot
        ? {
            chat_id: cachedWorkspaceSnapshot.chat_id,
            memory_summary: cachedWorkspaceSnapshot.memory_summary,
            messages: cachedWorkspaceSnapshot.messages,
            total_message_count: cachedWorkspaceSnapshot.total_message_count,
            has_more_messages: cachedWorkspaceSnapshot.has_more_messages,
          }
        : null;

  if (!chatId && agent && pages.length === 0 && !history) {
    const emptyWorkspace = {
      agent,
      chat_id: null,
      memory_summary: normalizeMemorySummary(null),
      messages: [],
      total_message_count: 0,
      has_more_messages: false,
      pages,
    } satisfies AgentResponseWorkspace;

    primeBackendAgentResponseWorkspaceCache(emptyWorkspace);
    return emptyWorkspace;
  }

  if (!agent || !history) {
    const firstError =
      agentResult.status === "rejected"
        ? agentResult.reason
        : historyResult.status === "rejected"
          ? historyResult.reason
          : pagesResult.status === "rejected"
            ? pagesResult.reason
            : new Error("Failed to load chat workspace");
    throw firstError;
  }

  const workspace = {
    agent,
    chat_id: history.chat_id,
    memory_summary: history.memory_summary,
    messages: history.messages,
    total_message_count: history.total_message_count,
    has_more_messages: history.has_more_messages,
    pages,
  } satisfies AgentResponseWorkspace;

  primeBackendAgentResponseWorkspaceCache(workspace);
  return workspace;
}

export async function fetchBackendAgentResponseWorkspace(
  agentId: string,
  chatId: string | null,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return getOrFetchSessionCached(
    backendAgentResponseWorkspaceCacheKey(agentId, chatId),
    BACKEND_AGENT_RESPONSE_WORKSPACE_CACHE_TTL_MS,
    () =>
      withBackendAuthRetry(
        (token) => fetchBackendAgentResponseWorkspaceRequest(agentId, chatId, token),
        accessToken,
        refreshAccessToken,
      ),
  );
}

async function fetchBackendAgentResponsePagesRequest(agentId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/response/pages`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load response pages"));
  }

  return (body as AgentResponsePage[]).map((page) => ({
    ...page,
    memory_summary: normalizeMemorySummary(page.memory_summary),
  }));
}

export async function fetchBackendAgentResponsePages(
  agentId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return getOrFetchSessionCached(
    backendAgentResponsePagesCacheKey(agentId),
    BACKEND_AGENT_RESPONSE_PAGES_CACHE_TTL_MS,
    () =>
      withBackendAuthRetry(
        (token) => fetchBackendAgentResponsePagesRequest(agentId, token),
        accessToken,
        refreshAccessToken,
      ),
  );
}

async function fetchBackendAllAgentResponsePagesRequest(accessToken: string) {
  const response = await fetch("/backend/api/v1/agents/response/pages", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load chats"));
  }

  return (body as AgentResponsePage[]).map((page) => ({
    ...page,
    memory_summary: normalizeMemorySummary(page.memory_summary),
  }));
}

export async function fetchBackendAllAgentResponsePages(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  try {
    const pages = await getOrFetchSessionCached(
      BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY,
      BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_TTL_MS,
      () =>
        withBackendAuthRetry(
          fetchBackendAllAgentResponsePagesRequest,
          accessToken,
          refreshAccessToken,
        ),
    );
    const pagesByAgent = new Map<string, AgentResponsePage[]>();
    for (const page of pages) {
      const agentPages = pagesByAgent.get(page.agent_id) ?? [];
      agentPages.push(page);
      pagesByAgent.set(page.agent_id, agentPages);
    }
    for (const [agentId, agentPages] of pagesByAgent) {
      primeSessionCache(
        backendAgentResponsePagesCacheKey(agentId),
        agentPages,
        BACKEND_AGENT_RESPONSE_PAGES_CACHE_TTL_MS,
      );
    }
    return pages;
  } catch (error) {
    const cachedPages = peekSessionCache<AgentResponsePage[]>(
      BACKEND_ALL_AGENT_RESPONSE_PAGES_CACHE_KEY,
      { allowExpired: true },
    );
    if (cachedPages?.length) {
      return cachedPages;
    }
    throw error;
  }
}

async function createBackendAgentResponsePageRequest(
  agentId: string,
  title: string | null,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/response/pages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title: title || undefined }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to create response page"));
  }

  return {
    ...(body as AgentResponsePage),
    memory_summary: normalizeMemorySummary((body as AgentResponsePage).memory_summary),
  };
}

export async function createBackendAgentResponsePage(
  agentId: string,
  title: string | null,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const createdPage = await withBackendAuthRetry(
    (token) => createBackendAgentResponsePageRequest(agentId, title, token),
    accessToken,
    refreshAccessToken,
  );
  invalidateBackendAgentResponseCaches(agentId);
  return createdPage;
}

async function deleteBackendAgentResponsePageRequest(
  agentId: string,
  chatId: string,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/response/pages/${chatId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, "Failed to delete response page"));
  }
}

export async function deleteBackendAgentResponsePage(
  agentId: string,
  chatId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  await withBackendAuthRetry(
    (token) => deleteBackendAgentResponsePageRequest(agentId, chatId, token),
    accessToken,
    refreshAccessToken,
  );
  invalidateBackendAgentResponseCaches(agentId, chatId);
}

async function fetchLatestBackendAgentResponseHistoryRequest(accessToken: string) {
  const response = await fetch("/backend/api/v1/agents/response/latest", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load latest agent response history"));
  }

  return normalizeBackendAgentResponseHistory(body);
}

export async function fetchLatestBackendAgentResponseHistory(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withBackendAuthRetry(
    fetchLatestBackendAgentResponseHistoryRequest,
    accessToken,
    refreshAccessToken,
  );
}

async function updateBackendAgentResponseMessageRequest(
  agentId: string,
  messageId: string,
  content: string,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/response/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to update message"));
  }

  return normalizeBackendAgentResponseHistory(body);
}

export async function updateBackendAgentResponseMessage(
  agentId: string,
  messageId: string,
  content: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const updatedHistory = await withBackendAuthRetry(
    (token) => updateBackendAgentResponseMessageRequest(agentId, messageId, content, token),
    accessToken,
    refreshAccessToken,
  );
  invalidateBackendAgentResponseCaches(agentId, updatedHistory.chat_id);
  return updatedHistory;
}

async function deleteBackendAgentResponseMessageRequest(
  agentId: string,
  messageId: string,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/response/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to delete message"));
  }

  return normalizeBackendAgentResponseHistory(body);
}

export async function deleteBackendAgentResponseMessage(
  agentId: string,
  messageId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const updatedHistory = await withBackendAuthRetry(
    (token) => deleteBackendAgentResponseMessageRequest(agentId, messageId, token),
    accessToken,
    refreshAccessToken,
  );
  invalidateBackendAgentResponseCaches(agentId, updatedHistory.chat_id);
  return updatedHistory;
}

async function updateBackendAgentRequest(
  agentId: string,
  updates: AgentUpdate,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(updates),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to update agent"));
  }

  return normalizeAgent(getApiSuccessData<Agent>(body));
}

export async function updateBackendAgent(
  agentId: string,
  updates: AgentUpdate,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const updatedAgent = await withBackendAuthRetry(
    (token) => updateBackendAgentRequest(agentId, updates, token),
    accessToken,
    refreshAccessToken,
  );
  primeSessionCache(backendAgentCacheKey(agentId), updatedAgent, BACKEND_AGENTS_CACHE_TTL_MS);
  mergeAgentIntoList(updatedAgent);
  invalidateBackendAgentResponseCaches(agentId);
  invalidateSessionCache(DASHBOARD_OVERVIEW_CACHE_KEY);
  return updatedAgent;
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
    throw new Error(getApiErrorMessage(body, "Failed to delete agent"));
  }
}

export async function deleteBackendAgent(
  agentId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  await withBackendAuthRetry(
    (token) => deleteBackendAgentRequest(agentId, token),
    accessToken,
    refreshAccessToken,
  );
  removeAgentFromList(agentId);
  invalidateBackendAgentCaches(agentId);
}

async function fetchBackendChatsRequest(agentId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/agents/${agentId}/chats`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load chats"));
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
    throw new Error(getApiErrorMessage(body, "Failed to create chat"));
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
    throw new Error(getApiErrorMessage(body, "Failed to delete chat"));
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
    throw new Error(getApiErrorMessage(body, "Failed to load messages"));
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
    throw new Error(getApiErrorMessage(body, "Failed to load messages"));
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
    throw new Error(getApiErrorMessage(body, "Failed to send message"));
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
    throw new Error(getApiErrorMessage(body, "Failed to send message"));
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
    throw new Error(getApiErrorMessage(body, "Failed to update message"));
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
    throw new Error(getApiErrorMessage(body, "Failed to update message"));
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
    throw new Error(getApiErrorMessage(body, "Failed to delete message"));
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
    throw new Error(getApiErrorMessage(body, "Failed to delete message"));
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
    category_tag: agent.category_tag || null,
    llm_engine: agent.llm_engine || "gpt-4o",
    status: agent.status || "enabled",
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
