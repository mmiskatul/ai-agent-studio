"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAgentActive, type Agent } from "@/lib/agent-api";
import { buildAgentChatRoute, buildAgentRoute } from "@/lib/routes";

interface AgentCardProps {
  agent: Agent;
  onDelete: (id: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  const router = useRouter();
  const active = isAgentActive(agent);

  return (
    <div
      className="agent-card flex cursor-pointer flex-col gap-3 p-5"
      onClick={() => router.push(buildAgentRoute(agent.id))}
      role="link"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(buildAgentRoute(agent.id));
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            agent.status === "enabled"
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {agent.status}
        </span>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">{agent.purpose}</p>

      {agent.template_type && (
        <span className="self-start rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {agent.template_type.toUpperCase()}
        </span>
      )}

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Link
          href={active ? buildAgentChatRoute(agent.id, agent.name) : "#"}
          className="flex-1"
          aria-disabled={!active}
          onClick={(event) => {
            if (!active) event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Button variant="default" size="sm" className="w-full gap-2" disabled={!active}>
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </Button>
        </Link>
        <Link href={buildAgentRoute(agent.id)} onClick={(event) => event.stopPropagation()}>
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(agent.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
