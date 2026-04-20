"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Plus } from "lucide-react";
import {
  fetchAgent,
  fetchAgents,
  fetchChatAgents,
  getOrCreateChat,
  fetchMessages,
  addMessage,
  type Agent,
  type ChatAgent,
  type Message,
} from "@/lib/agent-api";
import { streamChat } from "@/lib/chat-stream";
import { ChatInterface } from "@/components/ChatInterface";
import { Button } from "@/components/ui/button";
import { AUTHENTICATED_HOME } from "@/lib/routes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}

export default function ChatPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<ChatAgent[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const agentData = await fetchAgent(agentId);
        setAgent(agentData);
        const agentList = await fetchAgents();
        setAgents(agentList);
        const chat = await getOrCreateChat(agentId);
        setChatId(chat.id);
        const msgs = await fetchMessages(chat.id);
        setMessages(msgs);
        const chatAgents = await fetchChatAgents();
        setConversations(chatAgents);
      } catch (err) {
        console.error("Failed to load chat:", err);
        setError("Failed to load agent");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [agentId]);

  const refreshConversations = useCallback(async () => {
    try {
      const chatAgents = await fetchChatAgents();
      setConversations(chatAgents);
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
    }
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!chatId || !agent) return;
      setError(null);

      const userMsg = await addMessage(chatId, "user", content);
      setMessages((prev) => [...prev, userMsg]);
      refreshConversations();

      setIsStreaming(true);
      setStreamingContent("");

      let fullResponse = "";

      await streamChat({
        messages: [...messages, { sender_type: "user" as const, content }],
        systemPrompt: agent.system_prompt,
        onDelta: (delta) => {
          fullResponse += delta;
          setStreamingContent(fullResponse);
        },
        onDone: async () => {
          if (fullResponse) {
            const assistantMsg = await addMessage(chatId, "assistant", fullResponse);
            setMessages((prev) => [...prev, assistantMsg]);
            refreshConversations();
          }
          setStreamingContent("");
          setIsStreaming(false);
        },
        onError: (errMsg) => {
          setError(errMsg);
          setStreamingContent("");
          setIsStreaming(false);
        },
      });
    },
    [agent, chatId, messages, refreshConversations],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Agent not found</p>
        <Button variant="outline" onClick={() => router.push(AUTHENTICATED_HOME)}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const activeConversationIds = new Set(conversations.map((item) => item.agent.id));
  const conversationItems = [
    ...(agent && !activeConversationIds.has(agent.id)
      ? [
          {
            agent,
            preview: messages.at(-1)?.content || agent.purpose,
            time: messages.at(-1)?.created_at
              ? formatRelativeTime(messages.at(-1)?.created_at ?? "")
              : "Now",
            active: true,
          },
        ]
      : []),
    ...conversations.map((item) => ({
      agent: item.agent,
      preview: item.last_message.content,
      time: formatRelativeTime(item.last_message.created_at),
      active: item.agent.id === agent.id,
    })),
  ];

  return (
    <div className="grid h-[calc(100vh-3.5rem)] gap-3 p-4 lg:grid-cols-[274px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-bold text-foreground">Conversations</h2>
          <div className="mt-4">
            <Select
              value={agent.id}
              onValueChange={(selectedAgentId) => {
                if (selectedAgentId !== agent.id) {
                  router.push(`/agents/${selectedAgentId}/chat`);
                }
              }}
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
          <Link href="/create-chat">
            <Button className="mt-4 w-full gap-2 rounded-lg">
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {conversationItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversationItems.map((item) => (
                <Link
                  key={item.agent.id}
                  href={`/agents/${item.agent.id}/chat`}
                  className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                    item.active
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      item.active
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-foreground">
                        {item.agent.name}
                      </p>
                      <span className="text-xs font-medium text-muted-foreground">{item.time}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-muted-foreground">
                      {item.preview}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-hidden">
        <ChatInterface
          agent={agent}
          messages={messages}
          onSend={handleSend}
          isLoading={isStreaming}
          streamingContent={streamingContent}
          error={error}
        />
      </main>
    </div>
  );
}
