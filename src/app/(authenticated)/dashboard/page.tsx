"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Search, Bot } from "lucide-react";
import { fetchAgents, deleteAgent, type Agent } from "@/lib/agent-api";
import { AgentCard } from "@/components/AgentCard";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadAgents() {
    try {
      const data = await fetchAgents();
      setAgents(data);
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAgent(deleteTarget.id);
      setAgents((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch (err) {
      console.error("Failed to delete agent:", err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage your AI agents</p>
        </div>
        <Link href="/agents/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Agent
          </Button>
        </Link>
      </div>

      {agents.length > 0 && (
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="pl-10"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
          <Bot className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold text-foreground">No agents yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first AI agent to get started
          </p>
          <Link href="/agents/new">
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No agents match your search
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={(id) => setDeleteTarget(agents.find((a) => a.id === id) || null)}
            />
          ))}
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        agentName={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
