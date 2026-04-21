"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import {
  createBackendChat,
  deleteBackendChat,
  fetchBackendAgent,
  fetchBackendAgents,
  fetchBackendChatMessages,
  fetchBackendChats,
  deleteBackendChatMessage,
  sendBackendChatMessage,
  updateBackendChatMessage,
  isAgentActive,
  type Agent,
  type Chat,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
        <div className="mx-auto max-w-2xl space-y-5">
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
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-4 w-60" />
              <Skeleton className="h-4 w-44" />
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

function ChatWorkspaceSkeleton() {
  return (
    <div className="grid h-[calc(100vh-3.5rem)] gap-3 p-4 lg:grid-cols-[274px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-10 w-full rounded-lg" />
          <Skeleton className="mt-4 h-10 w-full rounded-lg" />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-start gap-3 rounded-lg p-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="min-h-0 overflow-hidden">
        <ChatSkeleton />
      </main>
    </div>
  );
}

function mergeMessagesById(messages: Message[]) {
  const messageMap = new Map<string, Message>();

  for (const message of messages) {
    messageMap.set(message.id, message);
  }

  return Array.from(messageMap.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export default function ChatPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const router = useRouter();
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSwitchingAgent, setIsSwitchingAgent] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [chatPendingDelete, setChatPendingDelete] = useState<Chat | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setChatTitle = useCallback((chatId: string, content: string) => {
    const title = content.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!title) return;

    setActiveChat((prev) => (prev?.id === chatId ? { ...prev, title } : prev));
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)));
  }, []);

  const loadAgentWorkspace = useCallback(
    async (selectedAgentId: string, updateUrl = false) => {
      if (!accessToken) return;

      const agentData = await fetchBackendAgent(selectedAgentId, accessToken, refreshAccessToken);
      if (!isAgentActive(agentData)) {
        throw new Error("This agent is inactive and cannot be used for chat.");
      }

      const chatList = await fetchBackendChats(selectedAgentId, accessToken, refreshAccessToken);

      const selectedChat =
        chatList[0] ?? (await createBackendChat(selectedAgentId, accessToken, refreshAccessToken));
      const nextMessages = selectedChat
        ? await fetchBackendChatMessages(
            selectedAgentId,
            selectedChat.id,
            accessToken,
            refreshAccessToken,
          )
        : [];

      setAgent(agentData);
      setChats(chatList.length > 0 ? chatList : [selectedChat]);
      setActiveChat(selectedChat);
      setMessages(mergeMessagesById(nextMessages));

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
        setError("Sign in again to load this chat.");
        return;
      }

      try {
        setError(null);
        const agentList = await fetchBackendAgents(accessToken, refreshAccessToken);
        setAgents(agentList.filter(isAgentActive));
        await loadAgentWorkspace(agentId);
      } catch (err) {
        console.error("Failed to load chat:", err);
        setError(err instanceof Error ? err.message : "Failed to load agent");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [accessToken, agentId, authLoading, loadAgentWorkspace, refreshAccessToken]);

  const switchAgent = useCallback(
    async (selectedAgentId: string, updateUrl = true) => {
      if (!selectedAgentId || selectedAgentId === agent?.id || !accessToken) return;

      setIsSwitchingAgent(true);
      setError(null);

      try {
        await loadAgentWorkspace(selectedAgentId, updateUrl);
      } catch (err) {
        console.error("Failed to switch agent:", err);
        setError(err instanceof Error ? err.message : "Failed to switch agent");
      } finally {
        setIsSwitchingAgent(false);
      }
    },
    [accessToken, agent?.id, loadAgentWorkspace],
  );

  const handleNewChat = useCallback(async () => {
    if (!agent || !accessToken) return;
    setError(null);
    setIsSwitchingAgent(true);

    try {
      const chat = await createBackendChat(agent.id, accessToken, refreshAccessToken);
      setChats((prev) => [chat, ...prev]);
      setActiveChat(chat);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create chat:", err);
      setError(err instanceof Error ? err.message : "Failed to create chat");
    } finally {
      setIsSwitchingAgent(false);
    }
  }, [accessToken, agent, refreshAccessToken]);

  const handleSelectChat = useCallback(
    async (chat: Chat) => {
      if (!agent || !accessToken || chat.id === activeChat?.id) return;
      setError(null);
      setIsLoadingChat(true);

      try {
        setActiveChat(chat);
        const messageList = await fetchBackendChatMessages(
          agent.id,
          chat.id,
          accessToken,
          refreshAccessToken,
        );
        setMessages(mergeMessagesById(messageList));
      } catch (err) {
        console.error("Failed to load chat:", err);
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setIsLoadingChat(false);
      }
    },
    [accessToken, activeChat?.id, agent, refreshAccessToken],
  );

  const handleDeleteChat = useCallback(async () => {
    if (!agent || !chatPendingDelete || !accessToken) return;

    setError(null);
    setDeletingChatId(chatPendingDelete.id);

    try {
      await deleteBackendChat(agent.id, chatPendingDelete.id, accessToken, refreshAccessToken);
      const remainingChats = chats.filter((chat) => chat.id !== chatPendingDelete.id);
      setChats(remainingChats);
      setChatPendingDelete(null);

      if (activeChat?.id !== chatPendingDelete.id) {
        return;
      }

      const nextChat = remainingChats[0] ?? null;
      setActiveChat(nextChat);
      if (!nextChat) {
        setMessages([]);
        return;
      }

      setIsLoadingChat(true);
      const messageList = await fetchBackendChatMessages(
        agent.id,
        nextChat.id,
        accessToken,
        refreshAccessToken,
      );
      setMessages(mergeMessagesById(messageList));
    } catch (err) {
      console.error("Failed to delete chat:", err);
      setError(err instanceof Error ? err.message : "Failed to delete chat");
    } finally {
      setIsLoadingChat(false);
      setDeletingChatId(null);
    }
  }, [accessToken, activeChat?.id, agent, chatPendingDelete, chats, refreshAccessToken]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!agent || !accessToken) return;
      setError(null);
      setIsStreaming(true);

      try {
        const chat =
          activeChat ?? (await createBackendChat(agent.id, accessToken, refreshAccessToken));
        if (!activeChat) {
          setActiveChat(chat);
          setChats((prev) => [chat, ...prev]);
        }
        const response = await sendBackendChatMessage(
          agent.id,
          chat.id,
          content,
          accessToken,
          refreshAccessToken,
        );
        setMessages((prev) =>
          mergeMessagesById([...prev, response.user_message, response.assistant_message]),
        );
        setChatTitle(chat.id, content);
      } catch (err) {
        console.error("Failed to send message:", err);
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsStreaming(false);
      }
    },
    [accessToken, activeChat, agent, refreshAccessToken, setChatTitle],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!agent || !activeChat || !accessToken) return;
      setError(null);
      setMessageActionId(messageId);

      try {
        await deleteBackendChatMessage(
          agent.id,
          activeChat.id,
          messageId,
          accessToken,
          refreshAccessToken,
        );
        setMessages((prev) => prev.filter((message) => message.id !== messageId));
      } catch (err) {
        console.error("Failed to delete message:", err);
        setError(err instanceof Error ? err.message : "Failed to delete message");
      } finally {
        setMessageActionId(null);
      }
    },
    [accessToken, activeChat, agent, refreshAccessToken],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!agent || !activeChat || !accessToken) return;
      setError(null);
      setMessageActionId(messageId);
      setIsStreaming(true);

      try {
        const isFirstUserMessage =
          messages.find((message) => message.sender_type === "user")?.id === messageId;
        const response = await updateBackendChatMessage(
          agent.id,
          activeChat.id,
          messageId,
          content,
          accessToken,
          refreshAccessToken,
        );
        setMessages((prev) => {
          const next = [...prev];
          const userIndex = next.findIndex((message) => message.id === response.user_message.id);
          if (userIndex >= 0) {
            next[userIndex] = response.user_message;
          }

          const assistantIndex = next.findIndex(
            (message) => message.id === response.assistant_message.id,
          );
          if (assistantIndex >= 0) {
            next[assistantIndex] = response.assistant_message;
          } else if (userIndex >= 0) {
            next.splice(userIndex + 1, 0, response.assistant_message);
          } else {
            next.push(response.user_message, response.assistant_message);
          }

          return mergeMessagesById(next);
        });
        if (isFirstUserMessage) {
          setChatTitle(activeChat.id, content);
        }
      } catch (err) {
        console.error("Failed to update message:", err);
        setError(err instanceof Error ? err.message : "Failed to update message");
      } finally {
        setIsStreaming(false);
        setMessageActionId(null);
      }
    },
    [accessToken, activeChat, agent, messages, refreshAccessToken, setChatTitle],
  );

  if (loading) {
    return <ChatWorkspaceSkeleton />;
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
          {isSwitchingAgent ? (
            <>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-4 h-10 w-full rounded-lg" />
              <Skeleton className="mt-4 h-10 w-full rounded-lg" />
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-foreground">Conversations</h2>
              <div className="mt-4">
                <Select
                  value={agent.id}
                  onValueChange={(selectedAgentId) => switchAgent(selectedAgentId)}
                >
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
              </div>
              <Button className="mt-4 w-full gap-2 rounded-lg" onClick={handleNewChat}>
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isSwitchingAgent ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3 rounded-lg p-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No chats yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-start gap-3 rounded-lg p-3 transition-colors ${
                    chat.id === activeChat?.id
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectChat(chat)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        chat.id === activeChat?.id
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-foreground">
                          {chat.title || "New chat"}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs font-medium text-muted-foreground">
                        {chat.title ? agent.name : "Ask the first question"}
                      </p>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                        disabled={deletingChatId === chat.id}
                        aria-label="Chat actions"
                      >
                        {deletingChatId === chat.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setChatPendingDelete(chat)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete chat
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
            messages={messages}
            onSend={handleSend}
            isLoading={isStreaming}
            streamingContent=""
            error={error}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            messageActionId={messageActionId}
            isLoadingHistory={isLoadingChat}
          />
        )}
      </main>

      <AlertDialog
        open={Boolean(chatPendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingChatId) {
            setChatPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {chatPendingDelete?.title || "this chat"}
              </span>{" "}
              and all messages inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingChatId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeleteChat();
              }}
              disabled={Boolean(deletingChatId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingChatId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete chat
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
