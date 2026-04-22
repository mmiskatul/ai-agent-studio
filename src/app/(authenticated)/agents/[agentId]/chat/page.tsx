"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, FileText, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBackendAgentResponsePage,
  deleteBackendAgentResponsePage,
  deleteBackendAgentResponseMessage,
  fetchBackendAgent,
  fetchBackendAgentResponseHistory,
  fetchBackendAgentResponsePages,
  generateBackendAgentResponse,
  isAgentActive,
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
import { AUTHENTICATED_HOME } from "@/lib/routes";
import { getChatErrorMessage, getErrorMessage } from "@/lib/error-message";
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

export default function ChatPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [pages, setPages] = useState<AgentResponsePage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSwitchingAgent, setIsSwitchingAgent] = useState(false);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [pageActionId, setPageActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memorySummary, setMemorySummary] = useState<MemorySummary>({
    title: "",
    description: "",
  });
  const currentChatId = searchParams.get("chatId");
  const activePageIdRef = useRef<string | null>(null);
  const loadedAgentIdRef = useRef<string | null>(null);
  const activePage = pages.find((page) => page.id === activePageId) ?? null;
  const routeAgentName = searchParams.get("name")?.trim() || "";
  const displayAgentName = agent?.name || routeAgentName || "Agent";
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

  const loadAgentWorkspace = useCallback(
    async (selectedAgentId: string, updateUrl = false, selectedPageId?: string | null) => {
      if (!accessToken) return;

      const [agentData, pageList] = await Promise.all([
        fetchBackendAgent(selectedAgentId, accessToken, refreshAccessToken),
        fetchBackendAgentResponsePages(selectedAgentId, accessToken, refreshAccessToken),
      ]);
      if (!isAgentActive(agentData)) {
        throw new Error("This agent is inactive and cannot generate responses.");
      }
      if (pageList.length === 0) {
        setAgent(agentData);
        setPages([]);
        setActivePageId(null);
        setMessages([]);
        setMemorySummary({ title: "", description: "" });

        if (updateUrl) {
          router.push(`/agents/${selectedAgentId}/chat`);
        }
        return;
      }

      const pageId =
        selectedPageId && pageList.some((page) => page.id === selectedPageId)
          ? selectedPageId
          : pageList[0]?.id || null;
      const history = await fetchBackendAgentResponseHistory(
        selectedAgentId,
        pageId,
        accessToken,
        refreshAccessToken,
      );
      const nextPageId = history.chat_id || pageId;
      setAgent(agentData);
      applyChatState(
        setPages,
        setActivePageId,
        setMessages,
        setMemorySummary,
        pageList,
        nextPageId,
        history.messages,
        history.memory_summary,
      );

      if (updateUrl) {
        router.push(`/agents/${selectedAgentId}/chat?chatId=${nextPageId}`);
      }
    },
    [accessToken, refreshAccessToken, router],
  );

  useEffect(() => {
    if (authLoading) return;

    async function init() {
      if (!accessToken) {
        setLoading(false);
        setError("Sign in again to load this agent.");
        return;
      }

      try {
        setError(null);
        if (loadedAgentIdRef.current === agentId) {
          if (activePageIdRef.current && activePageIdRef.current === currentChatId) {
            setLoading(false);
            return;
          }
        }

        await loadAgentWorkspace(agentId, false, currentChatId);
      } catch (err) {
        console.error("Failed to load agent response workspace:", err);
        const message = getErrorMessage(err, "Failed to load agent workspace.");
        setError(message);
        toast.error("Could not load chat", { description: message });
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [accessToken, agentId, authLoading, currentChatId, loadAgentWorkspace]);

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
        const history = await fetchBackendAgentResponseHistory(
          agent.id,
          pageId,
          accessToken,
          refreshAccessToken,
        );
        const nextPageId = history.chat_id || pageId;
        setPages((prev) => mergeActivePageSummary(prev, nextPageId, history.memory_summary));
        setActivePageId(nextPageId);
        setMessages(history.messages);
        setMemorySummary(history.memory_summary);
        router.replace(`/agents/${agent.id}/chat?chatId=${nextPageId}`);
      } catch (err) {
        console.error("Failed to switch response page:", err);
        const message = getErrorMessage(err, "Failed to switch chat.");
        setError(message);
        toast.error("Could not switch chat", { description: message });
      } finally {
        setIsSwitchingAgent(false);
      }
    },
    [accessToken, activePageId, agent, refreshAccessToken, router],
  );

  const createPage = useCallback(async () => {
    if (!agent || !accessToken) return;

    setIsCreatingPage(true);
    setError(null);

    try {
      const page = await createBackendAgentResponsePage(
        agent.id,
        "New Chat",
        accessToken,
        refreshAccessToken,
      );
      setPages((prev) => [page, ...prev]);
      setActivePageId(page.id);
      setMessages([]);
      setMemorySummary({ title: "", description: "" });
      router.replace(`/agents/${agent.id}/chat?chatId=${page.id}`);
    } catch (err) {
      console.error("Failed to create response page:", err);
      const message = getErrorMessage(err, "Failed to create chat.");
      setError(message);
      toast.error("Could not create chat", { description: message });
    } finally {
      setIsCreatingPage(false);
    }
  }, [accessToken, agent, refreshAccessToken, router]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!agent || !accessToken) return;

      setError(null);
      setIsGenerating(true);
      const optimisticMessage = createOptimisticUserMessage(content);
      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const response = await generateBackendAgentResponse(
          agent.id,
          content,
          activePageId,
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
        router.replace(`/agents/${agent.id}/chat?chatId=${nextPageId}`);
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
    [accessToken, activePageId, agent, pages, refreshAccessToken, router],
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
        if (history.chat_id) {
          router.replace(`/agents/${agent.id}/chat?chatId=${history.chat_id}`);
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
    [accessToken, agent, pages, refreshAccessToken, router],
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
        if (history.chat_id) {
          router.replace(`/agents/${agent.id}/chat?chatId=${history.chat_id}`);
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
    [accessToken, agent, pages, refreshAccessToken, router],
  );

  const handleDeletePage = useCallback(
    async (pageId: string) => {
      if (!agent || !accessToken) return;

      setError(null);
      setPageActionId(pageId);

      try {
        await deleteBackendAgentResponsePage(agent.id, pageId, accessToken, refreshAccessToken);

        const remainingPages = pages.filter((page) => page.id !== pageId);
        const nextPageId = pageId === activePageId ? (remainingPages[0]?.id ?? null) : activePageId;

        if (remainingPages.length === 0) {
          setPages([]);
          setActivePageId(null);
          setMessages([]);
          setMemorySummary({ title: "", description: "" });
          router.replace(`/agents/${agent.id}/chat`);
          return;
        }

        if (pageId !== activePageId) {
          setPages(remainingPages);
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
          router.replace(`/agents/${agent.id}/chat?chatId=${resolvedPageId}`);
        } else {
          setPages(remainingPages);
          router.replace(`/agents/${agent.id}/chat`);
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
    [accessToken, activePageId, agent, pages, refreshAccessToken, router],
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
          <h2 className="text-lg font-bold text-foreground">{displayAgentName}</h2>
          {pages.length > 0 ? (
            <div className="mt-4 space-y-3">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full gap-2 rounded-lg bg-background"
                disabled={isCreatingPage}
                onClick={createPage}
              >
                {isCreatingPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                New Chat
              </Button>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {pages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-3 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Start chatting to create the first chat for this agent.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  className={`group flex items-start gap-2 rounded-lg p-3 transition-colors ${
                    page.id === activePageId
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    onClick={() => selectPage(page.id)}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        page.id === activePageId
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {pageDisplayTitle(page, index, activePageId, memorySummary, messages)}
                      </p>
                    </div>
                  </button>

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
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-hidden">
        {loading || !agent ? (
          <ChatSkeleton />
        ) : (
          <ChatInterface
            agent={agent}
            pageTitle={activePageTitle}
            messages={messages}
            onSend={handleSend}
            isLoading={isGenerating}
            streamingContent=""
            error={error}
            messageActionId={messageActionId}
          />
        )}
      </main>
    </div>
  );
}
