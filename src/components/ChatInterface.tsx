import { useState, useRef, useEffect } from "react";
import { Send, Loader2, AlertCircle, Bot, User } from "lucide-react";
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
}

export function ChatInterface({
  agent,
  messages,
  onSend,
  isLoading,
  streamingContent,
  error,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    onSend(text);
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
        {messages.length === 0 && !streamingContent && (
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="max-w-md rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium leading-6 text-foreground shadow-sm">
              Hello! I&apos;m your AI assistant. How can I help you today?
            </div>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-4">
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
              <div
                className={`max-w-[80%] px-4 py-2.5 text-sm ${
                  msg.sender_type === "user" ? "chat-bubble-user" : "chat-bubble-assistant"
                }`}
              >
                {msg.sender_type === "assistant" ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
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
              <div className="chat-bubble-assistant max-w-[80%] px-4 py-2.5 text-sm">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
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
