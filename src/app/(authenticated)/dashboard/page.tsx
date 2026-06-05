"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, Bot, Check, CheckCircle2, Clock3, Filter, Search, Users } from "lucide-react";
import {
  DASHBOARD_OVERVIEW_CACHE_KEY,
  fetchDashboardOverview,
  type DashboardOverview,
  type DashboardAgentSummary,
} from "@/lib/dashboard-api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CHATS_ROUTE } from "@/lib/routes";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { peekSessionCache } from "@/lib/session-cache";

const emptyDashboard: DashboardOverview = {
  stats: {
    total_agents: 0,
    active_agents: 0,
    inactive_agents: 0,
    recently_updated_agents: 0,
    total_chats: 0,
    total_messages: 0,
    queries_30d: 0,
    total_leads: 0,
    total_staff: 0,
  },
  top_agents: [],
  categories: [],
  recent_activity: [],
};

function DashboardSkeleton() {
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="agent-card flex items-center gap-4 p-5">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      <div className="agent-card mb-8 overflow-hidden p-5">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { accessToken, refreshAccessToken } = useAuth();
  const cachedDashboard = peekSessionCache<DashboardOverview>(DASHBOARD_OVERVIEW_CACHE_KEY);
  const [dashboard, setDashboard] = useState<DashboardOverview>(cachedDashboard ?? emptyDashboard);
  const [loading, setLoading] = useState(!cachedDashboard);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    async function loadDashboard() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      if (!cachedDashboard) {
        setLoading(true);
      }
      try {
        const data = await fetchDashboardOverview(accessToken, refreshAccessToken);
        setDashboard(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [accessToken, cachedDashboard, refreshAccessToken]);

  const categories = ["All", ...dashboard.categories.map((item) => item.name)];
  const filteredTopAgents = dashboard.top_agents.filter((agent) => {
    const query = search.toLowerCase();
    const matchesSearch =
      agent.name.toLowerCase().includes(query) ||
      agent.role.toLowerCase().includes(query) ||
      agent.category.toLowerCase().includes(query);
    const matchesCategory = category === "All" || agent.category === category;
    return matchesSearch && matchesCategory;
  });

  const stats = [
    {
      label: "Total Agents",
      value: dashboard.stats.total_agents,
      description: "All agents created",
      icon: Bot,
    },
    {
      label: "Active Agents",
      value: dashboard.stats.active_agents,
      description: "Ready for chat",
      icon: CheckCircle2,
    },
    {
      label: "Inactive Agents",
      value: dashboard.stats.inactive_agents,
      description: "Currently paused",
      icon: Clock3,
    },
    {
      label: "Recently Updated",
      value: dashboard.stats.recently_updated_agents,
      description: "Changed in last 7 days",
      icon: Activity,
    },
    {
      label: "Total Leads",
      value: dashboard.stats.total_leads,
      description: "Captured across your agents",
      icon: Users,
    },
    {
      label: "Staff Members",
      value: dashboard.stats.total_staff,
      description: "Workspace team access",
      icon: Users,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Monitor agent activity, status, and recent workspace changes.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="h-10 rounded-lg bg-card pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`h-10 gap-2 rounded-lg bg-card px-5 ${
                  category !== "All" ? "border-primary text-primary" : ""
                }`}
              >
                <Filter className="h-4 w-4" />
                Filter
                {category !== "All" && (
                  <span className="max-w-24 truncate text-xs font-semibold">{category}</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Agent category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((item) => (
                <DropdownMenuItem
                  key={item}
                  className="flex cursor-pointer items-center justify-between capitalize"
                  onClick={() => setCategory(item)}
                >
                  {item}
                  {category === item && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="agent-card flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="agent-card mb-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Top agents for you</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Active and recently updated agents ranked first
                </p>
              </div>
            </div>

            {filteredTopAgents.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Create agents to see recommendations here.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-5">Agent</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopAgents.map((agent: DashboardAgentSummary) => (
                    <TableRow key={agent.id}>
                      <TableCell className="px-5 font-medium text-foreground">
                        {agent.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{agent.role}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            agent.status === "enabled"
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {agent.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{agent.category}</TableCell>
                      <TableCell className="text-right">
                        {agent.status === "enabled" ? (
                          <Link
                            href={`${CHATS_ROUTE}?agentId=${agent.id}&name=${encodeURIComponent(agent.name)}`}
                          >
                            <Button size="sm">Chat</Button>
                          </Link>
                        ) : (
                          <Button size="sm" disabled>
                            Chat
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
