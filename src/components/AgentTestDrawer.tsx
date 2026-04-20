"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import {
  addMessage,
  fetchAgent,
  fetchAgents,
  fetchMessages,
  getOrCreateChat,
  type Agent,
  type Message,
} from "@/lib/agent-api";
import { streamChat } from "@/lib/chat-stream";
import { ChatInterface } from "@/components/ChatInterface";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AgentTestDrawerProps {
  agentId?: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function AgentTestDrawer({
  agentId,
  open,
  onOpenChange,
  showTrigger = true,
}: AgentTestDrawerProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTestingChat() {
      setLoading(true);
      setError(null);
      setAgent(null);
      setChatId(null);
      setMessages([]);
      setStreamingContent("");
      setIsStreaming(false);

      try {
        const selectedAgent = agentId
          ? await fetchAgent(agentId)
          : await fetchAgents().then(
              (agents) => agents.find((item) => item.status === "active") ?? agents[0] ?? null,
            );

        if (!selectedAgent) {
          setAgent(null);
          return;
        }

        setAgent(selectedAgent);
        const chat = await getOrCreateChat(selectedAgent.id);
        setChatId(chat.id);
        const storedMessages = await fetchMessages(chat.id);
        setMessages(storedMessages);
      } catch (err) {
        console.error("Failed to load testing chat:", err);
        setError("Failed to load testing chat");
      } finally {
        setLoading(false);
      }
    }

    loadTestingChat();
  }, [agentId]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!agent || !chatId) return;

      setError(null);
      const userMessage = await addMessage(chatId, "user", content);
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setIsStreaming(true);
      setStreamingContent("");

      let fullResponse = "";

      await streamChat({
        messages: nextMessages.map((message) => ({
          sender_type: message.sender_type,
          content: message.content,
        })),
        systemPrompt: agent.system_prompt,
        onDelta: (delta) => {
          fullResponse += delta;
          setStreamingContent(fullResponse);
        },
        onDone: async () => {
          if (fullResponse) {
            const assistantMessage = await addMessage(chatId, "assistant", fullResponse);
            setMessages((prev) => [...prev, assistantMessage]);
          }
          setStreamingContent("");
          setIsStreaming(false);
        },
        onError: (errorMessage) => {
          setError(errorMessage);
          setStreamingContent("");
          setIsStreaming(false);
        },
      });
    },
    [agent, chatId, messages],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger && (
        <SheetTrigger asChild>
          <Button className="fixed right-0 top-1/2 z-40 h-28 -translate-y-1/2 rounded-l-lg rounded-r-none px-3 shadow-lg [writing-mode:vertical-rl]">
            Testing Message
          </Button>
        </SheetTrigger>
      )}
      <SheetContent side="right" className="flex w-[380px] max-w-[92vw] flex-col p-0 sm:max-w-none">
        <SheetHeader className="sr-only">
          <SheetTitle>Testing Message</SheetTitle>
          <SheetDescription>Test agent messages from a hidden right-side drawer.</SheetDescription>
        </SheetHeader>

        <div className="h-full min-h-0 bg-background p-3 pt-10">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : agent ? (
            <ChatInterface
              agent={agent}
              messages={messages}
              onSend={handleSend}
              isLoading={isStreaming}
              streamingContent={streamingContent}
              error={error}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <Bot className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <h3 className="text-base font-bold text-foreground">No agent available</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create an agent before testing chat from the drawer.
              </p>
              <Link href="/agents/new">
                <Button className="mt-4">Create Agent</Button>
              </Link>
              {error && <p className="mt-3 text-xs font-medium text-destructive">{error}</p>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
