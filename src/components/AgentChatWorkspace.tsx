"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, FileText, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteBackendAgentResponsePage,
  deleteBackendAgentResponseMessage,
  fetchBackendAllAgentResponsePages,
  fetchBackendAgentResponseHistory,
  fetchBackendAgentResponseWorkspace,
  generateBackendAgentResponse,
  isAgentActive,
  uploadAgentKnowledgeFile,
  updateBackendAgentResponseMessage,
  type Agent,
  type MemorySummary,
  type AgentResponsePage,
  type Message,
} from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { ChatInterface } from "@/components/ChatInterface";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AUTHENTICATED_HOME, CHATS_ROUTE } from "@/lib/routes";
import { getChatErrorMessage, getErrorMessage } from "@/lib/error-message";
import { peekSessionCache, primeSessionCache } from "@/lib/session-cache";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function createOptimisticUserMessage(content: string): Message {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return {
    id: `local_${random}`,
    chat_id: "pending",
    sender_type: "user",
    content,
    created_at: new Date().toISOString(),
  };
}

function createLocalAssistantMessage(chatId: string, content: string): Message {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return {
    id: `local_assistant_${random}`,
    chat_id: chatId,
    sender_type: "assistant",
    role: "assistant",
    content,
    created_at: new Date().toISOString(),
  };
}

function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex h-[68px] items-center gap-3 border-b border-border px-6">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-background/30 p-6">
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="flex justify-end">
            <div className="space-y-2">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="ml-auto h-4 w-40" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-border bg-background px-5 py-2 shadow-sm">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function mergeActivePageSummary(
  pages: AgentResponsePage[],
  pageId: string | null | undefined,
  memorySummary: MemorySummary,
) {
  if (!pageId) return pages;

  const title = memorySummary.title?.trim();
  return pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          title: title || page.title,
          memory_summary: memorySummary,
        }
      : page,
  );
}

function isWeakChatTitle(title?: string | null) {
  const normalized = title?.trim().toLowerCase().replace(/\s+/g, " ") || "";
  if (!normalized) return true;
  return (
    ["hi", "hello", "hey", "hii", "test", "ok", "okay", "thanks", "thank you"].includes(
      normalized,
    ) ||
    (normalized.split(" ").length < 3 && normalized.length < 18)
  );
}

function buildTitleFromMessages(messages: Message[]) {
  const assistantMessage = [...messages]
    .reverse()
    .find((message) => message.sender_type === "assistant" && message.content.trim());

  if (!assistantMessage) return "";

  const lines = assistantMessage.content
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^[#*\-\d.\s]+/, "")
        .replace(/[:.]+$/, ""),
    )
    .filter((line) => line.split(/\s+/).length >= 3);

  const source = lines[0] || assistantMessage.content.trim();
  const cleaned = source
    .replace(/^(here'?s|here is|below is|this is|sure,?)\s+(a|an|the)?\s*/i, "")
    .replace(/^brief\s+/i, "")
    .split(/[.!?:]\s+/)[0]
    .trim();

  if (isWeakChatTitle(cleaned)) return "";
  return cleaned.length <= 72 ? cleaned : `${cleaned.slice(0, 69).trim()}...`;
}

function pageDisplayTitle(
  page: AgentResponsePage,
  index: number,
  activePageId: string | null,
  memorySummary: MemorySummary,
  messages: Message[] = [],
) {
  const activeTitle = page.id === activePageId ? memorySummary.title?.trim() : "";
  const derivedTitle = page.id === activePageId ? buildTitleFromMessages(messages) : "";
  if (activeTitle && !isWeakChatTitle(activeTitle)) return activeTitle;
  if (derivedTitle) return derivedTitle;

  return (
    page.memory_summary.title?.trim() || page.title?.trim() || activeTitle || `Page ${index + 1}`
  );
}

function applyChatState(
  setPages: React.Dispatch<React.SetStateAction<AgentResponsePage[]>>,
  setActivePageId: React.Dispatch<React.SetStateAction<string | null>>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setMemorySummary: React.Dispatch<React.SetStateAction<MemorySummary>>,
  pages: AgentResponsePage[],
  pageId: string | null,
  messages: Message[],
  memorySummary: MemorySummary,
) {
  setPages(mergeActivePageSummary(pages, pageId, memorySummary));
  setActivePageId(pageId);
  setMessages(messages);
  setMemorySummary(memorySummary);
}

function updatePageCollection(
  pages: AgentResponsePage[],
  pageId: string | null,
  memorySummary: MemorySummary,
  messageCount: number,
) {
  if (!pageId) return pages;

  const nextUpdatedAt = new Date().toISOString();
  const nextTitle = memorySummary.title?.trim();

  return pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          title: nextTitle || page.title,
          memory_summary: memorySummary,
          message_count: messageCount,
          updated_at: nextUpdatedAt,
        }
      : page,
  );
}

function sortPagesByRecentActivity(pages: AgentResponsePage[]) {
  return [...pages].sort((left, right) => {
    const leftTimestamp = left.updated_at || left.created_at;
    const rightTimestamp = right.updated_at || right.created_at;
    return rightTimestamp.localeCompare(leftTimestamp);
  });
}

function updateAgentPagesMap(
  current: AgentResponsePage[],
  agentId: string,
  pages: AgentResponsePage[],
) {
  return sortPagesByRecentActivity([
    ...current.filter((page) => page.agent_id !== agentId),
    ...pages,
  ]);
}

type CachedChatState = {
  messages: Message[];
  memorySummary: MemorySummary;
  hasMoreMessages: boolean;
  totalMessageCount: number;
};

type CachedWorkspaceSnapshot = {
  agent: Agent;
  pages: AgentResponsePage[];
  activePageId: string | null;
  messages: Message[];
  memorySummary: MemorySummary;
  hasMoreMessages: boolean;
  totalMessageCount: number;
};

const WORKSPACE_SNAPSHOT_TTL_MS = 20_000;

function getWorkspaceSnapshotCacheKey(agentId: string, chatId: string | null) {
  return `chat-workspace:${agentId}:${chatId || "latest"}`;
}

function primeWorkspaceSnapshot(
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

export function AgentChatWorkspace({ routeAgentId = null }: { routeAgentId?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const currentChatId = searchParams.get("chatId");
  const queryAgentId = searchParams.get("agentId");
  const cachedSidebarChats = peekSessionCache<AgentResponsePage[]>(
    "backend-all-agent-response-pages",
    { allowExpired: true },
  );
  const initialSidebarPage = currentChatId
    ? cachedSidebarChats?.find((page) => page.id === currentChatId) ?? null
    : null;
  const initialTargetAgentId =
    routeAgentId ||
    queryAgentId ||
    initialSidebarPage?.agent_id ||
    cachedSidebarChats?.[0]?.agent_id ||
    null;
  const initialTargetChatId = currentChatId || initialSidebarPage?.id || cachedSidebarChats?.[0]?.id || null;
  const cachedWorkspaceSnapshot = initialTargetAgentId
      ? peekSessionCache<CachedWorkspaceSnapshot>(
        getWorkspaceSnapshotCacheKey(initialTargetAgentId, initialTargetChatId),
        { allowExpired: true },
      )
    : null;
  const [agent, setAgent] = useState<Agent | null>(cachedWorkspaceSnapshot?.agent ?? null);
  const [pages, setPages] = useState<AgentResponsePage[]>(cachedWorkspaceSnapshot?.pages ?? []);
  const [sidebarChats, setSidebarChats] = useState<AgentResponsePage[]>(cachedSidebarChats ?? []);
  const [activePageId, setActivePageId] = useState<string | null>(
    cachedWorkspaceSnapshot?.activePageId ?? null,
  );
  const [messages, setMessages] = useState<Message[]>(cachedWorkspaceSnapshot?.messages ?? []);
  const [loading, setLoading] = useState(!cachedWorkspaceSnapshot);
  const [isSwitchingAgent, setIsSwitchingAgent] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [pageActionId, setPageActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memorySummary, setMemorySummary] = useState<MemorySummary>(
    cachedWorkspaceSnapshot?.memorySummary ?? {
      title: "",
      description: "",
    },
  );
  const [hasMoreMessages, setHasMoreMessages] = useState(
    cachedWorkspaceSnapshot?.hasMoreMessages ?? false,
  );
  const [totalMessageCount, setTotalMessageCount] = useState(
    cachedWorkspaceSnapshot?.totalMessageCount ?? 0,
  );
  const activePageIdRef = useRef<string | null>(null);
  const loadedAgentIdRef = useRef<string | null>(null);
  const chatStateCacheRef = useRef<Record<string, CachedChatState>>({});
  const activePage = pages.find((page) => page.id === activePageId) ?? null;
  const activeAgentId = agent?.id ?? routeAgentId ?? "";
  const routeAgentName = searchParams.get("name")?.trim() || "";
  const displayAgentName = agent?.name || routeAgentName || "Agent";
  const flatSidebarChats = sortPagesByRecentActivity(
    updateAgentPagesMap(
      sidebarChats,
      activeAgentId,
      pages.map((page) => ({
        ...page,
        agent_name: page.agent_name || agent?.name || routeAgentName || null,
      })),
    ),
  ).map((page, index) => ({ page, index }));
  const buildChatRoute = useCallback(
    (targetAgentId: string, targetChatId?: string | null) => {
      if (!routeAgentId) {
        return targetChatId ? `${CHATS_ROUTE}?chatId=${targetChatId}` : CHATS_ROUTE;
      }

      return targetChatId
        ? `/agents/${targetAgentId}/chat?chatId=${targetChatId}`
        : `/agents/${targetAgentId}/chat`;
    },
    [routeAgentId],
  );
  const derivedActiveTitle = buildTitleFromMessages(messages);
  const activePageTitle =
    memorySummary.title?.trim() && !isWeakChatTitle(memorySummary.title)
      ? memorySummary.title.trim()
      : derivedActiveTitle ||
        activePage?.memory_summary.title?.trim() ||
        activePage?.title?.trim() ||
        "New chat";

  useEffect(() => {
    activePageIdRef.current = activePageId;
    loadedAgentIdRef.current = agent?.id ?? null;
  }, [activePageId, agent?.id]);

  const cacheChatState = useCallback(
    (
      chatId: string | null | undefined,
      nextMessages: Message[],
      nextMemorySummary: MemorySummary,
      nextHasMoreMessages = false,
      nextTotalMessageCount = nextMessages.length,
    ) => {
      if (!chatId) return;
      chatStateCacheRef.current[chatId] = {
        messages: nextMessages,
        memorySummary: nextMemorySummary,
        hasMoreMessages: nextHasMoreMessages,
        totalMessageCount: nextTotalMessageCount,
      };
    },
    [],
  );

  const loadSidebarChats = useCallback(
    async () => {
      if (!accessToken) return;

      const allPages = await fetchBackendAllAgentResponsePages(accessToken, refreshAccessToken);
      setSidebarChats(sortPagesByRecentActivity(allPages));
      return allPages;
    },
    [accessToken, refreshAccessToken],
  );

  const loadAgentWorkspace = useCallback(
    async (selectedAgentId: string, updateUrl = false, selectedPageId?: string | null) => {
      if (!accessToken) return;

      const workspace = await fetchBackendAgentResponseWorkspace(
        selectedAgentId,
        selectedPageId || null,
        accessToken,
        refreshAccessToken,
      );
      const agentData = workspace.agent;
      const pageList = workspace.pages;
      if (!isAgentActive(agentData)) {
        throw new Error("This agent is inactive and cannot generate responses.");
      }
      if (pageList.length === 0) {
        setAgent(agentData);
        setPages([]);
        setActivePageId(null);
        setMessages([]);
        setMemorySummary({ title: "", description: "" });
        setHasMoreMessages(false);
        setTotalMessageCount(0);

        if (updateUrl) {
          router.push(buildChatRoute(selectedAgentId));
        }
        return;
      }

      const nextPageId = workspace.chat_id || pageList[0]?.id || null;
      setAgent(agentData);
      setSidebarChats((current) =>
        updateAgentPagesMap(
          current,
          selectedAgentId,
          pageList.map((page) => ({
            ...page,
            agent_name: page.agent_name || agentData.name,
          })),
        ),
      );
      applyChatState(
        setPages,
        setActivePageId,
        setMessages,
        setMemorySummary,
        pageList,
        nextPageId,
        workspace.messages,
        workspace.memory_summary,
      );
      setHasMoreMessages(workspace.has_more_messages);
      setTotalMessageCount(workspace.total_message_count);
      cacheChatState(
        nextPageId,
        workspace.messages,
        workspace.memory_summary,
        workspace.has_more_messages,
        workspace.total_message_count,
      );
      primeWorkspaceSnapshot(
        agentData,
        pageList,
        nextPageId,
        workspace.messages,
        workspace.memory_summary,
        workspace.has_more_messages,
        workspace.total_message_count,
      );

      if (updateUrl) {
        router.push(buildChatRoute(selectedAgentId, nextPageId));
      }
    },
    [accessToken, buildChatRoute, cacheChatState, refreshAccessToken, router],
  );

  useEffect(() => {
    if (authLoading) return;

    async function init() {
      if (!accessToken) {
        setLoading(false);
        setError("Sign in again to load this agent.");
        return;
      }

      const isInitialLoad = loadedAgentIdRef.current === null;
      if (isInitialLoad) {
        if (!cachedWorkspaceSnapshot) {
          setLoading(true);
        }
      } else {
        setIsSwitchingAgent(true);
      }

      try {
        setError(null);
        const allPages = await loadSidebarChats();
        const selectedSidebarPage = currentChatId
          ? allPages?.find((page) => page.id === currentChatId) ?? null
          : null;
        const targetAgentId =
          routeAgentId || queryAgentId || selectedSidebarPage?.agent_id || allPages?.[0]?.agent_id;
        const targetChatId = currentChatId || selectedSidebarPage?.id || allPages?.[0]?.id || null;

        if (!targetAgentId) {
          setAgent(null);
          setPages([]);
          setActivePageId(null);
          setMessages([]);
          setMemorySummary({ title: "", description: "" });
          setHasMoreMessages(false);
          setTotalMessageCount(0);
          return;
        }

        const resolvedWorkspaceSnapshot = peekSessionCache<CachedWorkspaceSnapshot>(
          getWorkspaceSnapshotCacheKey(targetAgentId, targetChatId),
          { allowExpired: true },
        );
        if (resolvedWorkspaceSnapshot) {
          setAgent(resolvedWorkspaceSnapshot.agent);
          setPages(resolvedWorkspaceSnapshot.pages);
          setSidebarChats((current) =>
            updateAgentPagesMap(
              current,
              targetAgentId,
              resolvedWorkspaceSnapshot.pages.map((page) => ({
                ...page,
                agent_name: page.agent_name || resolvedWorkspaceSnapshot.agent.name,
              })),
            ),
          );
          setActivePageId(resolvedWorkspaceSnapshot.activePageId);
          setMessages(resolvedWorkspaceSnapshot.messages);
          setMemorySummary(resolvedWorkspaceSnapshot.memorySummary);
          setHasMoreMessages(resolvedWorkspaceSnapshot.hasMoreMessages);
          setTotalMessageCount(resolvedWorkspaceSnapshot.totalMessageCount);
          cacheChatState(
            resolvedWorkspaceSnapshot.activePageId,
            resolvedWorkspaceSnapshot.messages,
            resolvedWorkspaceSnapshot.memorySummary,
            resolvedWorkspaceSnapshot.hasMoreMessages,
            resolvedWorkspaceSnapshot.totalMessageCount,
          );
          setLoading(false);
        }

        if (loadedAgentIdRef.current === targetAgentId) {
          if (activePageIdRef.current && activePageIdRef.current === currentChatId) {
            setLoading(false);
            setIsSwitchingAgent(false);
            return;
          }
        }

        await loadAgentWorkspace(
          targetAgentId,
          !routeAgentId && !currentChatId && Boolean(targetChatId),
          targetChatId,
        );
      } catch (err) {
        console.error("Failed to load agent response workspace:", err);
        const message = getErrorMessage(err, "Failed to load agent workspace.");
        setError(message);
        toast.error("Could not load chat", { description: message });
      } finally {
        setLoading(false);
        setIsSwitchingAgent(false);
      }
    }

    init();
  }, [
    accessToken,
    authLoading,
    currentChatId,
    cachedWorkspaceSnapshot,
    loadAgentWorkspace,
    loadSidebarChats,
    queryAgentId,
    routeAgentId,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!agent) {
      document.title = "AgentHub - AI Agent Platform";
      return;
    }

    document.title = `${activePageTitle} | ${agent.name} | AgentHub`;
  }, [activePageTitle, agent]);

  const selectPage = useCallback(
    async (pageId: string) => {
      if (!agent || !accessToken || pageId === activePageId) return;

      setIsSwitchingAgent(true);
      setError(null);

      try {
        const cachedState = chatStateCacheRef.current[pageId];
        if (cachedState) {
          const nextPages = mergeActivePageSummary(pages, pageId, cachedState.memorySummary);
          setPages(nextPages);
          setSidebarChats((current) =>
            updateAgentPagesMap(
              current,
              agent.id,
              nextPages.map((page) => ({
                ...page,
                agent_name: page.agent_name || agent.name,
              })),
            ),
          );
          setActivePageId(pageId);
          setMessages(cachedState.messages);
          setMemorySummary(cachedState.memorySummary);
          setHasMoreMessages(cachedState.hasMoreMessages);
          setTotalMessageCount(cachedState.totalMessageCount);
          primeWorkspaceSnapshot(
            agent,
            nextPages,
            pageId,
            cachedState.messages,
            cachedState.memorySummary,
            cachedState.hasMoreMessages,
            cachedState.totalMessageCount,
          );
          router.replace(buildChatRoute(agent.id, pageId));
          return;
        }

        const history = await fetchBackendAgentResponseHistory(
          agent.id,
          pageId,
          accessToken,
          refreshAccessToken,
        );
        const nextPageId = history.chat_id || pageId;
        const nextPages = mergeActivePageSummary(pages, nextPageId, history.memory_summary);
        setPages(nextPages);
        setSidebarChats((current) =>
          updateAgentPagesMap(
            current,
            agent.id,
            nextPages.map((page) => ({
              ...page,
              agent_name: page.agent_name || agent.name,
            })),
          ),
        );
        setActivePageId(nextPageId);
        setMessages(history.messages);
        setMemorySummary(history.memory_summary);
        setHasMoreMessages(history.has_more_messages);
        setTotalMessageCount(history.total_message_count);
        cacheChatState(
          nextPageId,
          history.messages,
          history.memory_summary,
          history.has_more_messages,
          history.total_message_count,
        );
        primeWorkspaceSnapshot(
          agent,
          nextPages,
          nextPageId,
          history.messages,
          history.memory_summary,
          history.has_more_messages,
          history.total_message_count,
        );
        router.replace(buildChatRoute(agent.id, nextPageId));
      } catch (err) {
        console.error("Failed to switch response page:", err);
        const message = getErrorMessage(err, "Failed to switch chat.");
        setError(message);
        toast.error("Could not switch chat", { description: message });
      } finally {
        setIsSwitchingAgent(false);
      }
    },
    [accessToken, activePageId, agent, buildChatRoute, cacheChatState, pages, refreshAccessToken, router],
  );

  const handleSend = useCallback(
    async (content: string, file?: File | null) => {
      if (!agent || !accessToken) return;

      setError(null);
      setIsGenerating(true);
      const normalizedContent = content.trim();
      const optimisticContent =
        normalizedContent || (file ? `[Attached file: ${file.name}]` : content);
      const optimisticMessage = createOptimisticUserMessage(optimisticContent);
      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const uploadedAttachment = file
          ? await uploadAgentKnowledgeFile(file, accessToken, refreshAccessToken)
          : null;
        const response = await generateBackendAgentResponse(
          agent.id,
          normalizedContent,
          activePageId,
          uploadedAttachment?.extracted_text || null,
          uploadedAttachment?.file_name || file?.name || null,
          accessToken,
          refreshAccessToken,
        );
        const resolvedChatId = response.chat_id || activePageId;
        const history = await fetchBackendAgentResponseHistory(
          agent.id,
          resolvedChatId,
          accessToken,
          refreshAccessToken,
        );
        const fallbackMessages = response.local_fallback
          ? [
              {
                ...optimisticMessage,
                chat_id: resolvedChatId || "pending",
              },
              createLocalAssistantMessage(resolvedChatId || "pending", response.content),
            ]
          : null;
        const nextPageId = history.chat_id || resolvedChatId;
        const nextMemorySummary = history.memory_summary || response.memory_summary;
        const nextMessages =
          fallbackMessages && history.messages.length === 0 ? fallbackMessages : history.messages;
        const nextPages = updatePageCollection(
          pages,
          nextPageId,
          nextMemorySummary,
          nextMessages.length,
        );
        setSidebarChats((current) =>
          updateAgentPagesMap(
            current,
            agent.id,
            nextPages.map((page) => ({
              ...page,
              agent_name: page.agent_name || agent.name,
            })),
          ),
        );
        applyChatState(
          setPages,
          setActivePageId,
          setMessages,
          setMemorySummary,
          nextPages,
          nextPageId,
          nextMessages,
          nextMemorySummary,
        );
        setHasMoreMessages(false);
        setTotalMessageCount(nextMessages.length);
        cacheChatState(nextPageId, nextMessages, nextMemorySummary, false, nextMessages.length);
        primeWorkspaceSnapshot(
          agent,
          nextPages,
          nextPageId,
          nextMessages,
          nextMemorySummary,
          false,
          nextMessages.length,
        );
        router.replace(buildChatRoute(agent.id, nextPageId));
      } catch (err) {
        console.error("Failed to generate agent response:", err);
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
        const message = getChatErrorMessage(err);
        setError(message);
        toast.error("Could not generate response", { description: message });
      } finally {
        setIsGenerating(false);
      }
    },
    [accessToken, activePageId, agent, buildChatRoute, pages, refreshAccessToken, router],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!agent || !accessToken) return;

      setError(null);
      setMessageActionId(messageId);

      try {
        const history = await deleteBackendAgentResponseMessage(
          agent.id,
          messageId,
          accessToken,
          refreshAccessToken,
        );
        const nextPages = updatePageCollection(
          pages,
          history.chat_id,
          history.memory_summary,
          history.messages.length,
        );
        setSidebarChats((current) =>
          updateAgentPagesMap(
            current,
            agent.id,
            nextPages.map((page) => ({
              ...page,
              agent_name: page.agent_name || agent.name,
            })),
          ),
        );
        applyChatState(
          setPages,
          setActivePageId,
          setMessages,
          setMemorySummary,
          nextPages,
          history.chat_id,
          history.messages,
          history.memory_summary,
        );
        setHasMoreMessages(history.has_more_messages);
        setTotalMessageCount(history.total_message_count);
        cacheChatState(
          history.chat_id,
          history.messages,
          history.memory_summary,
          history.has_more_messages,
          history.total_message_count,
        );
        primeWorkspaceSnapshot(
          agent,
          nextPages,
          history.chat_id,
          history.messages,
          history.memory_summary,
          history.has_more_messages,
          history.total_message_count,
        );
        if (history.chat_id) {
          router.replace(buildChatRoute(agent.id, history.chat_id));
        }
      } catch (err) {
        console.error("Failed to delete agent response message:", err);
        const message = getErrorMessage(err, "Failed to delete message.");
        setError(message);
        toast.error("Could not delete message", { description: message });
      } finally {
        setMessageActionId(null);
      }
    },
    [accessToken, agent, buildChatRoute, cacheChatState, pages, refreshAccessToken, router],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!agent || !accessToken) return;

      setError(null);
      setMessageActionId(messageId);

      try {
        const history = await updateBackendAgentResponseMessage(
          agent.id,
          messageId,
          content,
          accessToken,
          refreshAccessToken,
        );
        const nextPages = updatePageCollection(
          pages,
          history.chat_id,
          history.memory_summary,
          history.messages.length,
        );
        setSidebarChats((current) =>
          updateAgentPagesMap(
            current,
            agent.id,
            nextPages.map((page) => ({
              ...page,
              agent_name: page.agent_name || agent.name,
            })),
          ),
        );
        applyChatState(
          setPages,
          setActivePageId,
          setMessages,
          setMemorySummary,
          nextPages,
          history.chat_id,
          history.messages,
          history.memory_summary,
        );
        setHasMoreMessages(history.has_more_messages);
        setTotalMessageCount(history.total_message_count);
        cacheChatState(
          history.chat_id,
          history.messages,
          history.memory_summary,
          history.has_more_messages,
          history.total_message_count,
        );
        primeWorkspaceSnapshot(
          agent,
          nextPages,
          history.chat_id,
          history.messages,
          history.memory_summary,
          history.has_more_messages,
          history.total_message_count,
        );
        if (history.chat_id) {
          router.replace(buildChatRoute(agent.id, history.chat_id));
        }
      } catch (err) {
        console.error("Failed to edit agent response message:", err);
        const message = getErrorMessage(err, "Failed to edit message.");
        setError(message);
        toast.error("Could not edit message", { description: message });
      } finally {
        setMessageActionId(null);
      }
    },
    [accessToken, agent, buildChatRoute, cacheChatState, pages, refreshAccessToken, router],
  );

  const handleDeletePage = useCallback(
    async (pageId: string) => {
      if (!agent || !accessToken) return;

      setError(null);
      setPageActionId(pageId);

      try {
        await deleteBackendAgentResponsePage(agent.id, pageId, accessToken, refreshAccessToken);
        delete chatStateCacheRef.current[pageId];

        const remainingPages = pages.filter((page) => page.id !== pageId);
        setSidebarChats((current) =>
          updateAgentPagesMap(
            current,
            agent.id,
            remainingPages.map((page) => ({
              ...page,
              agent_name: page.agent_name || agent.name,
            })),
          ),
        );
        const nextPageId = pageId === activePageId ? (remainingPages[0]?.id ?? null) : activePageId;

        if (remainingPages.length === 0) {
          setPages([]);
          setActivePageId(null);
          setMessages([]);
          setMemorySummary({ title: "", description: "" });
          setHasMoreMessages(false);
          setTotalMessageCount(0);
          router.replace(buildChatRoute(agent.id));
          return;
        }

        if (pageId !== activePageId) {
          setPages(remainingPages);
          primeWorkspaceSnapshot(
            agent,
            remainingPages,
            activePageId,
            messages,
            memorySummary,
            hasMoreMessages,
            totalMessageCount,
          );
          return;
        }

        if (nextPageId) {
          const history = await fetchBackendAgentResponseHistory(
            agent.id,
            nextPageId,
            accessToken,
            refreshAccessToken,
          );
          const resolvedPageId = history.chat_id || nextPageId;
          applyChatState(
            setPages,
            setActivePageId,
            setMessages,
            setMemorySummary,
            remainingPages,
            resolvedPageId,
            history.messages,
            history.memory_summary,
          );
          setHasMoreMessages(history.has_more_messages);
          setTotalMessageCount(history.total_message_count);
          cacheChatState(
            resolvedPageId,
            history.messages,
            history.memory_summary,
            history.has_more_messages,
            history.total_message_count,
          );
          primeWorkspaceSnapshot(
            agent,
            remainingPages,
            resolvedPageId,
            history.messages,
            history.memory_summary,
            history.has_more_messages,
            history.total_message_count,
          );
          router.replace(buildChatRoute(agent.id, resolvedPageId));
        } else {
          setPages(remainingPages);
          router.replace(buildChatRoute(agent.id));
        }
      } catch (err) {
        console.error("Failed to delete response page:", err);
        const message = getErrorMessage(err, "Failed to delete chat.");
        setError(message);
        toast.error("Could not delete chat", { description: message });
      } finally {
        setPageActionId(null);
      }
    },
    [
      accessToken,
      activePageId,
      agent,
      buildChatRoute,
      cacheChatState,
      hasMoreMessages,
      memorySummary,
      messages,
      pages,
      refreshAccessToken,
      router,
      totalMessageCount,
    ],
  );

  const openAgentWorkspace = useCallback(
    (targetAgentId: string, targetChatId?: string | null) => {
      if (targetAgentId === activeAgentId) {
        if (targetChatId) {
          void selectPage(targetChatId);
        } else {
          router.push(buildChatRoute(targetAgentId));
        }
        return;
      }

      setIsSwitchingAgent(true);
      router.push(buildChatRoute(targetAgentId, targetChatId));
    },
    [activeAgentId, buildChatRoute, router, selectPage],
  );

  if (!loading && !agent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || "Agent not found"}</p>
        <Button variant="outline" onClick={() => router.push(AUTHENTICATED_HOME)}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] gap-3 p-4 lg:grid-cols-[274px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Chats
          </p>
          <h2 className="mt-1 text-lg font-bold text-foreground">{displayAgentName}</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {flatSidebarChats.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-3 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No agents or chats found yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {flatSidebarChats.map(({ page, index }) => {
                const isActiveChat = page.agent_id === activeAgentId && page.id === activePageId;
                return (
                  <div
                    key={page.id}
                    className={`group flex items-start gap-2 rounded-lg p-3 transition-colors ${
                      isActiveChat
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      onClick={() => {
                        if (page.agent_id === activeAgentId) {
                          void selectPage(page.id);
                          return;
                        }
                        openAgentWorkspace(page.agent_id, page.id);
                      }}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isActiveChat
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background text-muted-foreground"
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {page.agent_name || "Agent"}
                        </p>
                        <p className="truncate text-sm font-bold text-foreground">
                          {pageDisplayTitle(
                            page,
                            index,
                            activePageId,
                            memorySummary,
                            isActiveChat ? messages : [],
                          )}
                        </p>
                      </div>
                    </button>

                    {page.agent_id === activeAgentId ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            disabled={pageActionId === page.id}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {pageActionId === page.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeletePage(page.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-hidden">
        {loading || isSwitchingAgent || !agent ? (
          <ChatSkeleton />
        ) : (
          <ChatInterface
            agent={agent}
            pageTitle={activePageTitle}
            messages={messages}
            onSend={handleSend}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            isLoading={isGenerating}
            streamingContent=""
            error={error}
            messageActionId={messageActionId}
            hasMoreMessages={hasMoreMessages}
            totalMessageCount={totalMessageCount}
          />
        )}
      </main>
    </div>
  );
}
