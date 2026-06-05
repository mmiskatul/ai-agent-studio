"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Check, Filter, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  BACKEND_AGENTS_CACHE_KEY,
  deleteBackendAgent,
  fetchBackendAgent,
  fetchBackendAgents,
  isAgentActive,
  updateBackendAgent,
  type Agent,
  type AgentUpdate,
} from "@/lib/agent-api";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/hooks/use-auth";
import { peekSessionCache } from "@/lib/session-cache";
import { AgentForm, type AgentFormValues } from "@/components/AgentForm";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchTemplates, TEMPLATE_CACHE_KEY, type AgentTemplate } from "@/lib/template-api";
import { buildStandardSystemPrompt } from "@/lib/standard-agent-prompt";
import { CHATS_ROUTE } from "@/lib/routes";

export default function AgentsPage() {
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const cachedAgents = peekSessionCache<Agent[]>(BACKEND_AGENTS_CACHE_KEY, {
    allowExpired: true,
  });
  const cachedTemplates = peekSessionCache<AgentTemplate[]>(TEMPLATE_CACHE_KEY, {
    allowExpired: true,
  });
  const [agents, setAgents] = useState<Agent[]>(cachedAgents ?? []);
  const [loading, setLoading] = useState(!cachedAgents);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editError, setEditError] = useState("");
  const [templates, setTemplates] = useState<AgentTemplate[]>(cachedTemplates ?? []);

  const loadAgents = useCallback(async () => {
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
      const message = getErrorMessage(err, "Failed to load agents");
      console.error("Failed to load agents:", err);
      setError(message);
      toast.error("Could not load agents", { description: message });
    } finally {
      setLoading(false);
    }
  }, [accessToken, refreshAccessToken]);

  useEffect(() => {
    if (authLoading) return;
    void loadAgents();
  }, [authLoading, loadAgents]);

  useEffect(() => {
    const token = accessToken;
    if (!token) return;

    async function loadTemplates(tokenValue: string) {
      try {
        const data = await fetchTemplates(tokenValue, refreshAccessToken);
        setTemplates(data);
      } catch (err) {
        if (templates.length > 0) {
          return;
        }
        const message = getErrorMessage(err, "Failed to load templates");
        toast.error("Could not load templates", { description: message });
      }
    }

    void loadTemplates(token);
  }, [accessToken, refreshAccessToken, templates.length]);

  async function handleOpenEdit(agentId: string) {
    if (!accessToken) return;

    setLoadingEditId(agentId);
    setEditError("");
    try {
      const agent = await fetchBackendAgent(agentId, accessToken, refreshAccessToken);
      setEditTarget(agent);
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load agent");
      console.error("Failed to load agent for editing:", err);
      setEditError(message);
      toast.error("Could not load agent", { description: message });
    } finally {
      setLoadingEditId(null);
    }
  }

  async function handleUpdate(values: AgentFormValues) {
    if (!editTarget || !accessToken) return;

    setIsUpdating(true);
    setEditError("");
    try {
      const selectedTemplate = templates.find((template) => template.id === values.templateId);
      const updated = await updateBackendAgent(
        editTarget.id,
        {
          name: values.name,
          role: values.role,
          purpose: values.purpose,
          description: values.purpose,
          knowledge_text: values.knowledgeText || null,
          language: values.language,
          status: values.status,
          template_type: selectedTemplate?.key || editTarget.template_type,
          template_id: values.templateId || null,
          system_prompt:
            editTarget.system_prompt ||
            selectedTemplate?.system_prompt ||
            buildStandardSystemPrompt({
              name: values.name,
              role: values.role,
              purpose: values.purpose,
              language: values.language,
              templateType: selectedTemplate?.key || "custom",
            }),
          is_active: values.status === "enabled",
        } satisfies AgentUpdate,
        accessToken,
        refreshAccessToken,
      );
      await loadAgents();
      setEditTarget(null);
      toast.success("Agent updated");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to update agent");
      console.error("Failed to update agent:", err);
      setEditError(message);
      toast.error("Could not update agent", { description: message });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !accessToken) return;

    setIsDeleting(true);
    try {
      await deleteBackendAgent(deleteTarget.id, accessToken, refreshAccessToken);
      await loadAgents();
      toast.success("Agent deleted");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to delete agent");
      console.error("Failed to delete agent:", err);
      toast.error("Could not delete agent", { description: message });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  const categoryOptions = useMemo(() => {
    const categories = agents.map((agent) => agent.template_type || "Custom").filter(Boolean);
    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const filteredAgents = agents
    .filter((agent) => {
      const query = search.trim().toLowerCase();
      const category = agent.template_type || "Custom";
      const matchesSearch =
        !query ||
        agent.name.toLowerCase().includes(query) ||
        agent.role.toLowerCase().includes(query) ||
        agent.purpose.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "queries") {
        return (b.queries_30d ?? 0) - (a.queries_30d ?? 0);
      }
      return b.updated_at.localeCompare(a.updated_at);
    });
  const visibleAgents = filteredAgents;
  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    sortBy !== "updated";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSortBy("updated");
  }

  function AgentsTableSkeleton() {
    return (
      <div className="agent-card overflow-hidden p-5">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
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

      <div className="mb-6 grid w-full gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto_auto]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents..."
            className="h-10 rounded-lg bg-card pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 rounded-lg bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-10 rounded-lg bg-card">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="queries">Most queries</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={`h-10 justify-between gap-2 rounded-lg bg-card px-4 ${
                categoryFilter !== "all" ? "border-primary text-primary" : ""
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </span>
              {categoryFilter !== "all" && (
                <span className="max-w-24 truncate text-xs font-semibold">{categoryFilter}</span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Agent category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer justify-between"
              onClick={() => setCategoryFilter("all")}
            >
              All categories
              {categoryFilter === "all" && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            {categoryOptions.map((category) => (
              <DropdownMenuItem
                key={category}
                className="cursor-pointer justify-between"
                onClick={() => setCategoryFilter(category)}
              >
                <span className="truncate">{category}</span>
                {categoryFilter === category && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <Button
            variant="outline"
            className="h-10 gap-2 rounded-lg bg-card"
            onClick={clearFilters}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <AgentsTableSkeleton />
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
          No agents match your filters.
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
                        agent.status === "enabled"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {agent.queries_30d ?? 0}
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
                      {isAgentActive(agent) ? (
                        <Link
                          href={`${CHATS_ROUTE}?agentId=${agent.id}&name=${encodeURIComponent(agent.name)}`}
                        >
                          <Button size="sm" className="gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Chat
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled
                          title="Activate this agent before opening chat"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Chat
                        </Button>
                      )}
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

          {editError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {editError}
            </div>
          ) : null}

          {editTarget && (
            <AgentForm
              key={editTarget.id}
              initialValues={{
                name: editTarget.name,
                role: editTarget.role,
                purpose: editTarget.description || editTarget.purpose,
                knowledgeText: editTarget.knowledge_text ?? "",
                language: editTarget.language,
                templateId: editTarget.template_id ?? "",
                status: editTarget.status,
              }}
              templates={templates}
              onSubmit={handleUpdate}
              onCancel={() => setEditTarget(null)}
              submitLabel="Update"
              isSubmitting={isUpdating}
              accessToken={accessToken}
              refreshAccessToken={refreshAccessToken}
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
