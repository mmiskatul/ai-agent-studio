"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CircleUserRound,
  Compass,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Users,
} from "lucide-react";
import {
  fetchBackendAgents,
  fetchLatestBackendAgentResponseHistory,
  isAgentActive,
} from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const pathname = usePathname();
  const { accessToken, refreshAccessToken, signOut } = useAuth();
  const [chatHref, setChatHref] = useState("/agents");

  useEffect(() => {
    if (!accessToken) {
      setChatHref("/agents");
      return;
    }

    const token = accessToken;
    let cancelled = false;

    async function resolveChatHref() {
      try {
        const latestHistory = await fetchLatestBackendAgentResponseHistory(
          token,
          refreshAccessToken,
        );

        if (!cancelled && latestHistory.agent_id) {
          setChatHref(`/agents/${latestHistory.agent_id}/chat`);
          return;
        }
      } catch {
        // Fall back to the first active agent when there is no latest conversation.
      }

      try {
        const agents = await fetchBackendAgents(token, refreshAccessToken);
        const chatAgent = agents.find(isAgentActive) ?? agents[0];

        if (!cancelled) {
          setChatHref(chatAgent ? `/agents/${chatAgent.id}/chat` : "/agents");
        }
      } catch {
        if (!cancelled) {
          setChatHref("/agents");
        }
      }
    }

    resolveChatHref();

    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshAccessToken]);

  const navItems = useMemo(
    () => [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Explore Agents", href: "/explore-agents", icon: Compass },
      { label: "Chat", href: chatHref, icon: MessageCircle },
      { label: "Agents", href: "/agents", icon: Users },
      { label: "Profile", href: "/profile", icon: CircleUserRound },
    ],
    [chatHref],
  );

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
        <Bot className="h-6 w-6 text-sidebar-primary" />
        <span className="text-lg font-semibold text-sidebar-foreground">AgentHub</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active =
            item.label === "Chat" ? pathname.includes("/chat") : pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
