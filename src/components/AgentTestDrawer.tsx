"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import {
  fetchBackendAgent,
  fetchBackendAgents,
  fetchBackendMessages,
  isAgentActive,
  sendBackendMessage,
  type Agent,
  type Message,
} from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
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
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    async function loadTestingChat() {
      setLoading(true);
      setError(null);
      setAgent(null);
      setMessages([]);
      setIsStreaming(false);

      if (!accessToken) {
        setError("Sign in again to test agents.");
        setLoading(false);
        return;
      }

      try {
        const selectedAgent = agentId
          ? await fetchBackendAgent(agentId, accessToken, refreshAccessToken)
          : await fetchBackendAgents(accessToken, refreshAccessToken).then(
              (agents) => agents.find(isAgentActive) ?? null,
            );

        if (!selectedAgent || !isAgentActive(selectedAgent)) {
          setAgent(null);
          setError("No active agent is available for testing chat.");
          return;
        }

        setAgent(selectedAgent);
        const storedMessages = await fetchBackendMessages(
          selectedAgent.id,
          accessToken,
          refreshAccessToken,
        );
        setMessages(storedMessages);
      } catch (err) {
        console.error("Failed to load testing chat:", err);
        setError(err instanceof Error ? err.message : "Failed to load testing chat");
      } finally {
        setLoading(false);
      }
    }

    loadTestingChat();
  }, [accessToken, agentId, authLoading, refreshAccessToken]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!agent || !accessToken) return;

      setError(null);
      setIsStreaming(true);

      try {
        const response = await sendBackendMessage(
          agent.id,
          content,
          accessToken,
          refreshAccessToken,
        );
        setMessages((prev) => [...prev, response.user_message, response.assistant_message]);
      } catch (err) {
        console.error("Failed to send testing message:", err);
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsStreaming(false);
      }
    },
    [accessToken, agent, refreshAccessToken],
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
              streamingContent=""
              error={error}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <Bot className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <h3 className="text-base font-bold text-foreground">No agent available</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Activate an agent before testing chat from the drawer.
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
