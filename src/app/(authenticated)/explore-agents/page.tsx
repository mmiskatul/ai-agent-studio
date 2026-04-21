"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Bot, BriefcaseBusiness, Filter, Search } from "lucide-react";
import { fetchBackendAgents, type Agent } from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const defaultCategories = ["All", "Analytics", "Design", "Engineering", "Legal", "Sales", "HR"];

function getAgentCategory(agent: Agent) {
  return agent.template_type || agent.role || "Custom";
}

export default function ExploreAgentsPage() {
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

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
        const data = await fetchBackendAgents(accessToken, refreshAccessToken);
        setAgents(data);
      } catch (err) {
        console.error("Failed to load agents:", err);
        setError(err instanceof Error ? err.message : "Failed to load agents");
      } finally {
        setLoading(false);
      }
    }

    loadAgents();
  }, [accessToken, authLoading, refreshAccessToken]);

  const categories = Array.from(
    new Set([...defaultCategories, ...agents.map((agent) => getAgentCategory(agent))]),
  );

  const filteredAgents = agents.filter((agent) => {
    const query = search.toLowerCase();
    const agentCategory = getAgentCategory(agent).toLowerCase();
    const matchesSearch =
      agent.name.toLowerCase().includes(query) ||
      agent.role.toLowerCase().includes(query) ||
      agent.purpose.toLowerCase().includes(query) ||
      agentCategory.includes(query);
    const matchesCategory = category === "All" || agentCategory === category.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Explore Agents</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Discover autonomous workflows built by experts.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search agents..."
              className="h-10 rounded-lg bg-card pl-10"
            />
          </div>
          <Button variant="outline" className="h-10 gap-2 rounded-lg bg-card px-5">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      <div className="mb-10 flex flex-wrap gap-2">
        {categories.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={category === item ? "default" : "outline"}
            className="rounded-lg px-4 capitalize"
            onClick={() => setCategory(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Bot className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold text-foreground">Could not load agents</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Bot className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold text-foreground">No agents available</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an agent before exploring workflows.
          </p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No agents match your search.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => {
            const agentCategory = getAgentCategory(agent);

            return (
              <div key={agent.id} className="agent-card flex min-h-64 flex-col p-7">
                <div className="mb-7 flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background">
                    <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="rounded-md bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {agentCategory}
                  </span>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                      {agent.name}
                    </h2>
                    {agent.status === "active" && (
                      <span className="h-2 w-2 rounded-full bg-primary" aria-label="Active" />
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-muted-foreground">
                    {agent.purpose}
                  </p>
                </div>

                <div className="mt-7 flex items-end justify-between border-t border-border pt-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Creator
                    </p>
                    <p className="mt-1 text-sm font-bold text-foreground">{agent.role}</p>
                  </div>

                  <Link href={`/agents/${agent.id}/chat`}>
                    <Button size="sm" className="gap-2 rounded-lg px-5">
                      Chat
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
