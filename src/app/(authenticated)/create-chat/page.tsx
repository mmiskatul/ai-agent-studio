"use client";

import { useEffect, useState } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, MessageSquare, Search, Send, X } from "lucide-react";
import {
  fetchBackendAgents,
  fetchLatestBackendAgentResponseHistory,
  isAgentActive,
  type Agent,
} from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreateChatPage() {
  const router = useRouter();
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categoryOptions = useMemo(() => {
    const categories = agents.map((agent) => agent.template_type || "Custom");
    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const query = agentSearch.trim().toLowerCase();
    return agents.filter((agent) => {
      const category = agent.template_type || "Custom";
      const matchesSearch =
        !query ||
        agent.name.toLowerCase().includes(query) ||
        agent.role.toLowerCase().includes(query) ||
        agent.purpose.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "all" || category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [agentSearch, agents, categoryFilter]);

  const hasAgentFilters = Boolean(agentSearch.trim()) || categoryFilter !== "all";

  function clearAgentFilters() {
    setAgentSearch("");
    setCategoryFilter("all");
  }

  function openAgentChat(agentId: string) {
    if (!agentId) return;
    router.push(`/agents/${agentId}/chat`);
  }

  useEffect(() => {
    if (authLoading) return;

    async function loadAgents() {
      if (!accessToken) {
        setLoading(false);
        setError("Sign in again to load your agents.");
        return;
      }

      try {
        setError("");
        try {
          const latestHistory = await fetchLatestBackendAgentResponseHistory(
            accessToken,
            refreshAccessToken,
          );
          if (latestHistory.agent_id) {
            setRedirecting(true);
            router.replace(`/agents/${latestHistory.agent_id}/chat`);
            return;
          }
        } catch (latestErr) {
          if (!(latestErr instanceof Error) || latestErr.message !== "Chat not found") {
            console.info("No latest chat to open automatically:", latestErr);
          }
        }

        const data = await fetchBackendAgents(accessToken, refreshAccessToken);
        setAgents(data.filter(isAgentActive));
      } catch (err) {
        console.error("Failed to load agents:", err);
        setError(err instanceof Error ? err.message : "Failed to load agents");
      } finally {
        setLoading(false);
      }
    }

    loadAgents();
  }, [accessToken, authLoading, refreshAccessToken, router]);

  return (
    <div className="grid h-[calc(100vh-3.5rem)] gap-3 p-4 lg:grid-cols-[274px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h1 className="text-lg font-bold text-foreground">Conversations</h1>
          <div className="mt-4 space-y-3">
            <Select
              disabled={loading || redirecting || filteredAgents.length === 0}
              onValueChange={openAgentChat}
            >
              <SelectTrigger className="h-10 rounded-lg bg-background">
                <SelectValue
                  placeholder={
                    redirecting
                      ? "Opening latest chat..."
                      : loading
                        ? "Loading agents..."
                        : "Select agent"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={agentSearch}
                onChange={(event) => setAgentSearch(event.target.value)}
                placeholder="Search chat agents..."
                className="h-10 rounded-lg bg-background pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 min-w-0 flex-1 rounded-lg bg-background">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasAgentFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-lg bg-background"
                  onClick={clearAgentFilters}
                  aria-label="Clear agent filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading || redirecting ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Could not load agents</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No active agents available</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Activate an agent before starting a chat.
              </p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No chat agents match</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clear filters or search another agent.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg p-3 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                  onClick={() => openAgentChat(agent.id)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-foreground">{agent.name}</p>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-muted-foreground">
                      {agent.purpose}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
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
