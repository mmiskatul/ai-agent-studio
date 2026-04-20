import { Link } from "@tanstack/react-router";
import { Bot, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/lib/agent-api";

interface AgentCardProps {
  agent: Agent;
  onDelete: (id: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  return (
    <div className="agent-card flex flex-col gap-3 p-5">
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
            agent.status === "active"
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
        <Link to="/agents/$agentId/chat" params={{ agentId: agent.id }} className="flex-1" preload={false}>
          <Button variant="default" size="sm" className="w-full gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </Button>
        </Link>
        <Link to="/agents/$agentId" params={{ agentId: agent.id }} preload={false}>
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => onDelete(agent.id)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
