"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import {
  deleteBackendAgentResponseMessage,
  fetchBackendAgent,
  fetchBackendAgentResponseHistory,
  fetchBackendAgents,
  generateBackendAgentResponse,
  isAgentActive,
  uploadAgentKnowledgeFile,
  updateBackendAgentResponseMessage,
  type Agent,
  type Message,
} from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { getChatErrorMessage, getErrorMessage } from "@/lib/error-message";
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

export function AgentTestDrawer({
  agentId,
  open,
  onOpenChange,
  showTrigger = true,
}: AgentTestDrawerProps) {
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOpen = open ?? internalOpen;

  useEffect(() => {
    if (authLoading || !isOpen) return;

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
        const history = await fetchBackendAgentResponseHistory(
          selectedAgent.id,
          null,
          accessToken,
          refreshAccessToken,
        );
        setMessages(history.messages);
      } catch (err) {
        console.error("Failed to load testing chat:", err);
        const message = getErrorMessage(err, "Failed to load testing chat.");
        setError(message);
        toast.error("Could not load test chat", { description: message });
      } finally {
        setLoading(false);
      }
    }

    loadTestingChat();
  }, [accessToken, agentId, authLoading, isOpen, refreshAccessToken]);

  const handleSend = useCallback(
    async (content: string, file?: File | null) => {
      if (!agent || !accessToken) return;

      setError(null);
      setIsStreaming(true);
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
          null,
          uploadedAttachment?.extracted_text || null,
          uploadedAttachment?.file_name || file?.name || null,
          accessToken,
          refreshAccessToken,
        );
        const history = await fetchBackendAgentResponseHistory(
          agent.id,
          null,
          accessToken,
          refreshAccessToken,
        );
        if (response.local_fallback && history.messages.length === 0) {
          setMessages([
            { ...optimisticMessage, chat_id: response.chat_id },
            createLocalAssistantMessage(response.chat_id, response.content),
          ]);
          return;
        }
        setMessages(history.messages);
      } catch (err) {
        console.error("Failed to send testing message:", err);
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
        const message = getChatErrorMessage(err);
        setError(message);
        toast.error("Could not generate response", { description: message });
      } finally {
        setIsStreaming(false);
      }
    },
    [accessToken, agent, refreshAccessToken],
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
        setMessages(history.messages);
      } catch (err) {
        console.error("Failed to delete testing message:", err);
        const message = getErrorMessage(err, "Failed to delete message.");
        setError(message);
        toast.error("Could not delete message", { description: message });
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
        setMessages(history.messages);
      } catch (err) {
        console.error("Failed to edit testing message:", err);
        const message = getErrorMessage(err, "Failed to edit message.");
        setError(message);
        toast.error("Could not edit message", { description: message });
      } finally {
        setMessageActionId(null);
      }
    },
    [accessToken, agent, refreshAccessToken],
  );

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (open === undefined) {
          setInternalOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
      }}
    >
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
              messageActionId={messageActionId}
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
