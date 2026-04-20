import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { fetchAgent, getOrCreateChat, fetchMessages, addMessage, type Agent, type Message } from "@/lib/agent-api";
import { streamChat } from "@/lib/chat-stream";
import { ChatInterface } from "@/components/ChatInterface";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/agents/$agentId/chat")({
  head: () => ({
    meta: [
      { title: "Chat — AgentHub" },
      { name: "description", content: "Test your AI agent in a chat" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { agentId } = Route.useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
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
        const chat = await getOrCreateChat(agentId);
        setChatId(chat.id);
        const msgs = await fetchMessages(chat.id);
        setMessages(msgs);
      } catch (err) {
        console.error("Failed to load chat:", err);
        setError("Failed to load agent");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [agentId]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!chatId || !agent) return;
      setError(null);

      const userMsg = await addMessage(chatId, "user", content);
      setMessages((prev) => [...prev, userMsg]);

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
    [chatId, agent, messages],
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
        <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          agent={agent}
          messages={messages}
          onSend={handleSend}
          isLoading={isStreaming}
          streamingContent={streamingContent}
          error={error}
        />
      </div>
    </div>
  );
}
