"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bot, FileText, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import {
  createBackendAgentResponsePage,
  deleteBackendAgentResponsePage,
  deleteBackendAgentResponseMessage,
  fetchBackendAgent,
  fetchBackendAgentResponseHistory,
  fetchBackendAgentResponsePages,
  fetchBackendAgents,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function PageListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-lg p-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const router = useRouter();
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
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
  const activePage = pages.find((page) => page.id === activePageId) ?? null;
  const activePageTitle =
    activePage?.memory_summary.title?.trim() || activePage?.title?.trim() || "New page";

  const loadAgentWorkspace = useCallback(
    async (selectedAgentId: string, updateUrl = false, selectedPageId?: string | null) => {
      if (!accessToken) return;

      const agentData = await fetchBackendAgent(selectedAgentId, accessToken, refreshAccessToken);
      if (!isAgentActive(agentData)) {
        throw new Error("This agent is inactive and cannot generate responses.");
      }

      setAgent(agentData);
      let pageList = await fetchBackendAgentResponsePages(
        selectedAgentId,
        accessToken,
        refreshAccessToken,
      );
      if (pageList.length === 0) {
        const firstPage = await createBackendAgentResponsePage(
          selectedAgentId,
          "New page",
          accessToken,
          refreshAccessToken,
        );
        pageList = [firstPage];
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
      setPages(pageList);
      setActivePageId(history.chat_id || pageId);
      setMessages(history.messages);
      setMemorySummary(history.memory_summary);

      if (updateUrl) {
        window.history.pushState(null, "", `/agents/${selectedAgentId}/chat`);
      }
    },
    [accessToken, refreshAccessToken],
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
        const agentList = await fetchBackendAgents(accessToken, refreshAccessToken);
        setAgents(agentList.filter(isAgentActive));
        await loadAgentWorkspace(agentId);
      } catch (err) {
        console.error("Failed to load agent response workspace:", err);
        setError(err instanceof Error ? err.message : "Failed to load agent");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [accessToken, agentId, authLoading, loadAgentWorkspace, refreshAccessToken]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!agent) {
      document.title = "AgentHub - AI Agent Platform";
      return;
    }

    document.title = `${activePageTitle} | ${agent.name} | AgentHub`;
  }, [activePageTitle, agent]);

  const switchAgent = useCallback(
    async (selectedAgentId: string) => {
      if (!selectedAgentId || selectedAgentId === agent?.id || !accessToken) return;

      setIsSwitchingAgent(true);
      setError(null);

      try {
        await loadAgentWorkspace(selectedAgentId, true);
      } catch (err) {
        console.error("Failed to switch agent:", err);
        setError(err instanceof Error ? err.message : "Failed to switch agent");
      } finally {
        setIsSwitchingAgent(false);
      }
    },
    [accessToken, agent?.id, loadAgentWorkspace],
  );

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
        setActivePageId(history.chat_id || pageId);
        setMessages(history.messages);
        setMemorySummary(history.memory_summary);
      } catch (err) {
        console.error("Failed to switch response page:", err);
        setError(err instanceof Error ? err.message : "Failed to switch page");
      } finally {
        setIsSwitchingAgent(false);
      }
    },
    [accessToken, activePageId, agent, refreshAccessToken],
  );

  const createPage = useCallback(async () => {
    if (!agent || !accessToken) return;

    setIsCreatingPage(true);
    setError(null);

    try {
      const page = await createBackendAgentResponsePage(
        agent.id,
        `Page ${pages.length + 1}`,
        accessToken,
        refreshAccessToken,
      );
      setPages((prev) => [page, ...prev]);
      setActivePageId(page.id);
      setMessages([]);
      setMemorySummary({ title: "", description: "" });
    } catch (err) {
      console.error("Failed to create response page:", err);
      setError(err instanceof Error ? err.message : "Failed to create page");
    } finally {
      setIsCreatingPage(false);
    }
  }, [accessToken, agent, pages.length, refreshAccessToken]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!agent || !accessToken || !activePageId) return;

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
        const history = await fetchBackendAgentResponseHistory(
          agent.id,
          response.chat_id || activePageId,
          accessToken,
          refreshAccessToken,
        );
        const nextPages = await fetchBackendAgentResponsePages(
          agent.id,
          accessToken,
          refreshAccessToken,
        );
        setPages(nextPages);
        setActivePageId(history.chat_id || response.chat_id || activePageId);
        setMessages(history.messages);
        setMemorySummary(history.memory_summary || response.memory_summary);
      } catch (err) {
        console.error("Failed to generate agent response:", err);
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
        setError(err instanceof Error ? err.message : "Failed to generate agent response");
      } finally {
        setIsGenerating(false);
      }
    },
    [accessToken, activePageId, agent, refreshAccessToken],
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
        const nextPages = await fetchBackendAgentResponsePages(
          agent.id,
          accessToken,
          refreshAccessToken,
        );
        setPages(nextPages);
        setActivePageId(history.chat_id);
        setMessages(history.messages);
        setMemorySummary(history.memory_summary);
      } catch (err) {
        console.error("Failed to delete agent response message:", err);
        setError(err instanceof Error ? err.message : "Failed to delete message");
      } finally {
        setMessageActionId(null);
      }
    },
    [accessToken, agent, refreshAccessToken],
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
        const nextPages = await fetchBackendAgentResponsePages(
          agent.id,
          accessToken,
          refreshAccessToken,
        );
        setPages(nextPages);
        setActivePageId(history.chat_id);
        setMessages(history.messages);
        setMemorySummary(history.memory_summary);
      } catch (err) {
        console.error("Failed to edit agent response message:", err);
        setError(err instanceof Error ? err.message : "Failed to edit message");
      } finally {
        setMessageActionId(null);
      }
    },
    [accessToken, agent, refreshAccessToken],
  );

  const handleDeletePage = useCallback(
    async (pageId: string) => {
      if (!agent || !accessToken) return;

      setError(null);
      setPageActionId(pageId);

      try {
        await deleteBackendAgentResponsePage(agent.id, pageId, accessToken, refreshAccessToken);

        const nextPages = await fetchBackendAgentResponsePages(
          agent.id,
          accessToken,
          refreshAccessToken,
        );
        const nextPageId =
          pageId === activePageId
            ? (nextPages.find((page) => page.id !== pageId)?.id ?? null)
            : activePageId;

        if (nextPages.length === 0) {
          await loadAgentWorkspace(agent.id);
          return;
        }

        if (nextPageId) {
          const history = await fetchBackendAgentResponseHistory(
            agent.id,
            nextPageId,
            accessToken,
            refreshAccessToken,
          );
          setPages(nextPages);
          setActivePageId(history.chat_id || nextPageId);
          setMessages(history.messages);
          setMemorySummary(history.memory_summary);
        } else {
          setPages(nextPages);
        }
      } catch (err) {
        console.error("Failed to delete response page:", err);
        setError(err instanceof Error ? err.message : "Failed to delete page");
      } finally {
        setPageActionId(null);
      }
    },
    [accessToken, activePageId, agent, loadAgentWorkspace, refreshAccessToken],
  );

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-3.5rem)] gap-3 p-4 lg:grid-cols-[274px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-10 w-full rounded-lg" />
        </aside>
        <main className="min-h-0 overflow-hidden">
          <ChatSkeleton />
        </main>
      </div>
    );
  }

  if (!agent) {
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
      <aside
        className={`flex min-h-0 flex-col rounded-xl border border-border bg-card ${
          isSwitchingAgent ? "pointer-events-none" : ""
        }`}
      >
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-bold text-foreground">Agent Response</h2>
          <div className="mt-4 space-y-3">
            <Select value={agent.id} onValueChange={switchAgent}>
              <SelectTrigger className="h-10 rounded-lg bg-background">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
              New Page
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isSwitchingAgent ? (
            <PageListSkeleton />
          ) : pages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-3 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Create a page to start separate memory for this agent.
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
                        {page.memory_summary.title?.trim() ||
                          page.title?.trim() ||
                          `Page ${index + 1}`}
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
        {isSwitchingAgent ? (
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
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            messageActionId={messageActionId}
          />
        )}
      </main>
    </div>
  );
}
