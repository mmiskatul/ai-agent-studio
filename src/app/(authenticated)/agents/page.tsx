"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Filter, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  deleteBackendAgent,
  fetchBackendAgent,
  fetchBackendAgents,
  updateBackendAgent,
  type Agent,
  type AgentUpdate,
} from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { AgentForm } from "@/components/AgentForm";
import { AgentTestDrawer } from "@/components/AgentTestDrawer";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AgentsPage() {
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [queryCounts, setQueryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [testAgentId, setTestAgentId] = useState<string | null>(null);
  const [showTestingDrawer, setShowTestingDrawer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        setQueryCounts({});
      } catch (err) {
        console.error("Failed to load agents:", err);
        setError(err instanceof Error ? err.message : "Failed to load agents");
      } finally {
        setLoading(false);
      }
    }

    loadAgents();
  }, [accessToken, authLoading, refreshAccessToken]);

  async function handleOpenEdit(agentId: string) {
    if (!accessToken) return;

    setLoadingEditId(agentId);
    try {
      const agent = await fetchBackendAgent(agentId, accessToken, refreshAccessToken);
      setEditTarget(agent);
    } catch (err) {
      console.error("Failed to load agent for editing:", err);
    } finally {
      setLoadingEditId(null);
    }
  }

  async function handleUpdate(values: AgentUpdate) {
    if (!editTarget || !accessToken) return;

    setIsUpdating(true);
    try {
      const updated = await updateBackendAgent(
        editTarget.id,
        values,
        accessToken,
        refreshAccessToken,
      );
      setAgents((prev) => prev.map((agent) => (agent.id === updated.id ? updated : agent)));
      setEditTarget(null);
    } catch (err) {
      console.error("Failed to update agent:", err);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !accessToken) return;

    setIsDeleting(true);
    try {
      await deleteBackendAgent(deleteTarget.id, accessToken, refreshAccessToken);
      setAgents((prev) => prev.filter((agent) => agent.id !== deleteTarget.id));
      setQueryCounts((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
    } catch (err) {
      console.error("Failed to delete agent:", err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  const filteredAgents = agents.filter((agent) => {
    const query = search.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.role.toLowerCase().includes(query) ||
      agent.purpose.toLowerCase().includes(query)
    );
  });
  const visibleAgents = filteredAgents;

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <AgentTestDrawer
        agentId={testAgentId}
        open={showTestingDrawer}
        onOpenChange={setShowTestingDrawer}
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Agents</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Create, manage, edit, and chat with your agents.
          </p>
        </div>

        <Link href="/agents/new">
          <Button className="gap-2 rounded-lg px-5">
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents..."
            className="h-10 rounded-lg bg-card pl-10"
          />
        </div>
        <Button variant="outline" className="h-10 gap-2 rounded-lg bg-card">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
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
          <h2 className="text-lg font-semibold text-foreground">No agents created</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create an agent to manage it here.</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No agents match your search.
        </p>
      ) : (
        <div className="agent-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Queries (30D)</TableHead>
                <TableHead className="px-5 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAgents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="px-5">
                    <div className="flex min-w-64 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{agent.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                        agent.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {queryCounts[agent.id] ?? 0}
                  </TableCell>
                  <TableCell className="px-5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={loadingEditId === agent.id}
                        onClick={() => handleOpenEdit(agent.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {loadingEditId === agent.id ? "Loading..." : "Edit"}
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setTestAgentId(agent.id);
                          setShowTestingDrawer(true);
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(agent)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
          </DialogHeader>

          {editTarget && (
            <AgentForm
              key={editTarget.id}
              initialValues={{
                name: editTarget.name,
                role: editTarget.role,
                purpose: editTarget.purpose,
                templateType: editTarget.template_type ?? "",
                systemPrompt: editTarget.system_prompt,
                status: editTarget.status,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditTarget(null)}
              submitLabel="Update"
              isSubmitting={isUpdating}
            />
          )}
        </DialogContent>
      </Dialog>

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
