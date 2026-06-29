"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Bot, MessageSquare, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  BACKEND_AGENTS_CACHE_KEY,
  fetchBackendAgent,
  isAgentActive,
  type Agent,
} from "@/lib/agent-api";
import { buildAgentChatRoute, buildAgentRoute } from "@/lib/routes";
import { peekSessionCache } from "@/lib/session-cache";
import { cn } from "@/lib/utils";

export function AgentRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const cachedAgents =
    peekSessionCache<Agent[]>(BACKEND_AGENTS_CACHE_KEY, { allowExpired: true }) ?? [];
  const cachedAgent = cachedAgents.find((item) => item.id === agentId) ?? null;
  const [agent, setAgent] = useState<Agent | null>(cachedAgent);

  useEffect(() => {
    if (authLoading || !accessToken) return;

    let cancelled = false;

    void fetchBackendAgent(agentId, accessToken, refreshAccessToken)
      .then((nextAgent) => {
        if (!cancelled) {
          setAgent(nextAgent);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [accessToken, agentId, authLoading, refreshAccessToken]);

  const editHref = buildAgentRoute(agentId);
  const chatHref = buildAgentChatRoute(agentId, agent?.name);
  const active = agent ? isAgentActive(agent) : true;
  const isChatRoute = pathname.endsWith("/chat");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-foreground">
                  {agent?.name || "Agent workspace"}
                </h1>
                <p className="truncate text-sm text-muted-foreground">
                  {agent?.purpose || agent?.role || "Manage this agent and its chat workspace."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={editHref} prefetch>
              <span
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors",
                  !isChatRoute
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </span>
            </Link>
            <Link href={chatHref} prefetch aria-disabled={!active} tabIndex={active ? 0 : -1}>
              <span
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors",
                  isChatRoute
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                  !active && "pointer-events-none opacity-50",
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-0">{children}</div>
    </div>
  );
}
