"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Fingerprint,
  LogOut,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { fetchAgents, fetchChatAgents, type Agent, type ChatAgent } from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ProfilePage() {
  const { user, accessToken, sessionToken, signOut } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [chatAgents, setChatAgents] = useState<ChatAgent[]>([]);
  const initial = user?.email?.trim().charAt(0).toUpperCase() || "U";
  const displayName = user?.email?.split("@")[0] || "User";
  const activeAgents = agents.filter((agent) => agent.status === "active").length;
  const inactiveAgents = agents.length - activeAgents;
  const totalMessages = chatAgents.reduce((total, item) => total + item.message_count, 0);
  const latestAgent = agents[0];
  const latestConversation = chatAgents[0];

  useEffect(() => {
    async function loadProfileStats() {
      try {
        const [agentData, chatData] = await Promise.all([fetchAgents(), fetchChatAgents()]);
        setAgents(agentData);
        setChatAgents(chatData);
      } catch (err) {
        console.error("Failed to load profile stats:", err);
      }
    }

    loadProfileStats();
  }, []);

  const stats = [
    { label: "Total Agents", value: agents.length, icon: Bot },
    { label: "Active Agents", value: activeAgents, icon: CheckCircle2 },
    { label: "Inactive Agents", value: inactiveAgents, icon: Clock3 },
    { label: "Messages", value: totalMessages, icon: MessageCircle },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Manage your account details and workspace activity.
        </p>
      </div>

      <section className="agent-card mb-6 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
              {initial}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CircleUserRound className="h-5 w-5 text-primary" />
                <h2 className="truncate text-2xl font-bold text-foreground">{displayName}</h2>
              </div>
              <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Email</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user?.email ?? "No email available"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/agents/new">
              <Button className="w-full sm:w-auto">Create Agent</Button>
            </Link>
            <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="agent-card flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="agent-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Account Details</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">User ID</p>
              <div className="mt-2 flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <p className="truncate text-sm font-semibold text-foreground">
                  {user?.id ?? "Not available"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Session</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <p className="text-sm font-semibold text-foreground">
                  {accessToken && sessionToken ? "Authenticated" : "Limited"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Latest Agent</p>
              <p className="mt-2 truncate text-sm font-semibold text-foreground">
                {latestAgent?.name ?? "No agents created"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Created {formatDate(latestAgent?.created_at)}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Latest Conversation
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-foreground">
                {latestConversation?.agent.name ?? "No conversations yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {latestConversation
                  ? `${latestConversation.message_count} messages`
                  : "Start a chat to see activity"}
              </p>
            </div>
          </div>
        </section>

        <aside className="agent-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Quick Activity</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-sm font-bold text-foreground">Agent workspace</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {agents.length > 0
                  ? `${agents.length} agents created across your workspace.`
                  : "No agents created yet."}
              </p>
              <Link href="/agents">
                <Button variant="outline" size="sm" className="mt-3">
                  Manage Agents
                </Button>
              </Link>
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-sm font-bold text-foreground">Chat access</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open an existing chat or choose an agent from the conversation selector.
              </p>
              <Link href="/agents/chat">
                <Button variant="outline" size="sm" className="mt-3">
                  Open Chat
                </Button>
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
