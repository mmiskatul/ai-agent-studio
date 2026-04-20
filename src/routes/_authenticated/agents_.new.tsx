import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createAgent } from "@/lib/agent-api";
import { AgentForm } from "@/components/AgentForm";

export const Route = createFileRoute("/_authenticated/agents_/new")({
  head: () => ({
    meta: [
      { title: "Create Agent — AgentHub" },
      { name: "description", content: "Create a new AI agent" },
    ],
  }),
  component: NewAgentPage,
});

function NewAgentPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: {
    name: string;
    role: string;
    purpose: string;
    template_type: string;
    system_prompt: string;
    status: string;
  }) {
    setIsSubmitting(true);
    try {
      await createAgent(values);
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Create New Agent</h1>
      <div className="rounded-xl border border-border bg-card p-6">
        <AgentForm
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: "/" })}
          submitLabel="Create Agent"
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
