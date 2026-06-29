import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  AlertCircle,
  Bot,
  User,
  Pencil,
  Trash2,
  Check,
  X,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Agent, Message } from "@/lib/agent-api";

interface ChatInterfaceProps {
  agent: Agent;
  pageTitle?: string;
  messages: Message[];
  onSend: (content: string, file?: File | null) => void;
  isLoading: boolean;
  streamingContent: string;
  error: string | null;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  messageActionId?: string | null;
  isLoadingHistory?: boolean;
  hasMoreMessages?: boolean;
  totalMessageCount?: number;
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
  hasMoreMessages = false,
  totalMessageCount = 0,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousMessageCountRef = useRef(messages.length);
  const previousStreamingRef = useRef(Boolean(streamingContent));
  const welcomeMessage =
    agent.welcome_message?.trim() ||
    `Hi, I'm ${agent.name}. I can help with ${
      agent.purpose || agent.description || agent.role
    }. Share what you need, and I'll guide you through the next best steps.`;

  useEffect(() => {
    const didAppendMessage = messages.length > previousMessageCountRef.current;
    const isStreamingNow = Boolean(streamingContent);
    const startedStreaming = isStreamingNow && !previousStreamingRef.current;
    const behavior = didAppendMessage || startedStreaming ? "smooth" : "auto";

    bottomRef.current?.scrollIntoView({ behavior });
    previousMessageCountRef.current = messages.length;
    previousStreamingRef.current = isStreamingNow;
  }, [messages.length, streamingContent]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  function handleSend() {
    const text = input.trim();
    if ((!text && !selectedFile) || isLoading) return;
    const file = selectedFile;
    setInput("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onSend(text, file);
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
      <div className="flex h-15 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Bot className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-foreground">
              {pageTitle?.trim() || agent.name}
            </h2>
            {agent.status === "enabled" && <span className="h-2 w-2 rounded-full bg-primary" />}
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

        {hasMoreMessages && (
          <div className="mb-4 flex justify-center">
            <div className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              Showing recent messages only ({messages.length} of {totalMessageCount})
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            setSelectedFile(file);
          }}
          disabled={isLoading}
        />
        <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-background px-5 py-3 shadow-sm">
          {selectedFile && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedFile.name}</span>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                disabled={isLoading}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
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
            disabled={isLoading || (!input.trim() && !selectedFile)}
            size="icon"
            className="h-9 w-9 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
