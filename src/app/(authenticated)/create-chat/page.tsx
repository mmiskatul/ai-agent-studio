"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, MessageSquare, Plus, Send } from "lucide-react";
import { fetchAgents, type Agent } from "@/lib/agent-api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const staticConversations = [
  {
    id: "data-analyst-pro",
    name: "Data Analyst Pro",
    preview: "Revenue grew 14% this quarter.",
    time: "2m",
    active: true,
  },
  {
    id: "devops-helper",
    name: "DevOps Helper",
    preview: "Docker config looks correct.",
    time: "1h",
    active: false,
  },
  {
    id: "ux-copywriter",
    name: "UX Copywriter",
    preview: "Here are 3 options for you.",
    time: "3h",
    active: false,
  },
];

export default function CreateChatPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    async function loadAgents() {
      try {
        const data = await fetchAgents();
        setAgents(data);
      } catch (err) {
        console.error("Failed to load agents:", err);
      }
    }

    loadAgents();
  }, []);

  return (
    <div className="grid h-[calc(100vh-3.5rem)] gap-3 p-4 lg:grid-cols-[274px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h1 className="text-lg font-bold text-foreground">Conversations</h1>
          <div className="mt-4">
            <Select onValueChange={(agentId) => router.push(`/agents/${agentId}/chat`)}>
              <SelectTrigger className="h-10 rounded-lg bg-background">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="mt-4 w-full gap-2 rounded-lg">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {staticConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                  conversation.active
                    ? "bg-primary/10"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    conversation.active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground"
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-foreground">
                      {conversation.name}
                    </p>
                    <span
                      className={`text-xs font-medium ${
                        conversation.active ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {conversation.time}
                    </span>
                  </div>
                  <p
                    className={`mt-1 line-clamp-1 text-xs font-medium ${
                      conversation.active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {conversation.preview}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <header className="flex h-[68px] items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Data Analyst Pro</h2>
              <span className="h-2 w-2 rounded-full bg-primary" aria-label="Verified" />
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Online
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-background/30 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <BriefcaseBusiness className="h-4 w-4" />
            </div>
            <div className="max-w-md rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium leading-6 text-foreground shadow-sm">
              Hello! I&apos;m your AI assistant. How can I help you today?
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-card p-4">
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-border bg-background px-5 py-2 shadow-sm">
            <input
              placeholder="Ask your agent anything..."
              className="h-9 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
            <Button size="icon" className="h-9 w-9 rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
