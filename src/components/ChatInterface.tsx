import { useState, useRef, useEffect } from "react";
import { Send, Loader2, AlertCircle, Bot, User, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import type { Agent, Message } from "@/lib/agent-api";

interface ChatInterfaceProps {
  agent: Agent;
  messages: Message[];
  onSend: (content: string) => void;
  isLoading: boolean;
  streamingContent: string;
  error: string | null;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  messageActionId?: string | null;
  isLoadingHistory?: boolean;
}

export function ChatInterface({
  agent,
  messages,
  onSend,
  isLoading,
  streamingContent,
  error,
  onDeleteMessage,
  onEditMessage,
  messageActionId,
  isLoadingHistory = false,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const welcomeMessage =
    agent.welcome_message?.trim() ||
    `Hi, I'm ${agent.name}. I can help with ${agent.purpose}. Share what you need, and I'll guide you through the next best steps.`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    onSend(text);
  }

  function startEditing(message: Message) {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  }

  function cancelEditing() {
    setEditingMessageId(null);
    setEditingContent("");
  }

  function submitEditing(messageId: string) {
    const nextContent = editingContent.trim();
    if (!nextContent || !onEditMessage) return;
    const currentMessage = messages.find((message) => message.id === messageId);
    if (currentMessage && nextContent === currentMessage.content.trim()) {
      cancelEditing();
      return;
    }
    onEditMessage(messageId, nextContent);
    cancelEditing();
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex h-[68px] items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">{agent.name}</h2>
            {agent.status === "active" && <span className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Online
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-background/30 p-6">
        {isLoadingHistory && (
          <div className="mb-4 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading chat
            </div>
          </div>
        )}

        <div className="w-full space-y-4">
          <div className="flex justify-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex max-w-[80%] flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">{agent.name}</span>
              <div className="chat-bubble-assistant px-4 py-2.5 text-sm">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender_type === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender_type === "assistant" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className="group flex max-w-[80%] flex-col gap-1">
                <span
                  className={`text-xs font-semibold text-muted-foreground ${
                    msg.sender_type === "user" ? "text-right" : "text-left"
                  }`}
                >
                  {msg.sender_type === "user" ? "You" : agent.name}
                </span>
                <div
                  className={`px-4 py-2.5 text-sm ${
                    msg.sender_type === "user" ? "chat-bubble-user" : "chat-bubble-assistant"
                  }`}
                >
                  {editingMessageId === msg.id ? (
                    <div className="flex min-w-72 items-center gap-2">
                      <input
                        value={editingContent}
                        onChange={(event) => setEditingContent(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitEditing(msg.id);
                          }
                          if (event.key === "Escape") {
                            cancelEditing();
                          }
                        }}
                        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-7 w-7"
                        disabled={messageActionId === msg.id}
                        onClick={() => submitEditing(msg.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={cancelEditing}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : msg.sender_type === "assistant" ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>

                <div
                  className={`flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                    msg.sender_type === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.sender_type === "user" && onEditMessage && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={isLoading || messageActionId === msg.id}
                      onClick={() => startEditing(msg)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onDeleteMessage && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={isLoading || messageActionId === msg.id}
                      onClick={() => onDeleteMessage(msg.id)}
                    >
                      {messageActionId === msg.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              {msg.sender_type === "user" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex max-w-[80%] flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">{agent.name}</span>
                <div className="chat-bubble-assistant px-4 py-2.5 text-sm">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoading && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
              <div className="chat-bubble-assistant px-4 py-2.5 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border bg-card p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-border bg-background px-5 py-2 shadow-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask your agent anything..."
            className="h-9 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-9 w-9 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
