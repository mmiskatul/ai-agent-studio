import { useState, useRef, useEffect } from "react";
import { Send, Loader2, AlertCircle, Bot, User, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Agent, Message } from "@/lib/agent-api";

interface ChatInterfaceProps {
  agent: Agent;
  pageTitle?: string;
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

const markdownComponents = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mb-3 mt-1 text-xl font-bold leading-tight text-foreground" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mb-2 mt-1 text-lg font-bold leading-tight text-foreground" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-2 mt-1 text-base font-bold leading-tight text-foreground" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-2 leading-6 first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ol: ({ children, ...props }: React.OlHTMLAttributes<HTMLOListElement>) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5" {...props}>
      {children}
    </ol>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="pl-1 leading-6" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-bold text-foreground" {...props}>
      {children}
    </strong>
  ),
  a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="font-semibold text-primary underline underline-offset-4"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] font-semibold" {...props}>
      {children}
    </code>
  ),
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border-b border-border bg-muted px-3 py-2 font-bold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-border px-3 py-2 align-top last:border-b-0" {...props}>
      {children}
    </td>
  ),
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

export function ChatInterface({
  agent,
  pageTitle,
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const welcomeMessage =
    agent.welcome_message?.trim() ||
    `Hi, I'm ${agent.name}. I can help with ${
      agent.purpose || agent.description || agent.role
    }. Share what you need, and I'll guide you through the next best steps.`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

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
            <h2 className="text-base font-bold text-foreground">
              {pageTitle?.trim() || agent.name}
            </h2>
            {agent.status === "active" && <span className="h-2 w-2 rounded-full bg-primary" />}
          </div>
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
                  <MarkdownMessage content={welcomeMessage} />
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
                      <MarkdownMessage content={msg.content} />
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
                    <MarkdownMessage content={streamingContent} />
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
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-background px-5 py-2 shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask your agent anything..."
            rows={1}
            className="max-h-40 min-h-9 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-sm font-medium leading-5 outline-none placeholder:text-muted-foreground"
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
