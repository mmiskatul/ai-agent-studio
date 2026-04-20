import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { fetchAgent, updateAgent, deleteAgent, type Agent } from "@/lib/agent-api";
import { AgentForm } from "@/components/AgentForm";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agents/$agentId")({
  head: () => ({
    meta: [
      { title: "Edit Agent — AgentHub" },
      { name: "description", content: "Edit your AI agent configuration" },
    ],
  }),
  component: EditAgentPage,
});

function EditAgentPage() {
  const { agentId } = Route.useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAgent(agentId)
      .then(setAgent)
      .catch(() => setError("Agent not found"))
      .finally(() => setLoading(false));
  }, [agentId]);

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
      await updateAgent(agentId, values);
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to update agent:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteAgent(agentId);
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to delete agent:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">{error || "Agent not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/" })}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Edit Agent</h1>
        <Button variant="outline" size="sm" className="gap-2 text-destructive" onClick={() => setShowDelete(true)}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <AgentForm
          initialValues={{
            name: agent.name,
            role: agent.role,
            purpose: agent.purpose,
            templateType: agent.template_type ?? "",
            systemPrompt: agent.system_prompt,
            status: agent.status,
          }}
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: "/" })}
          submitLabel="Save Changes"
          isSubmitting={isSubmitting}
        />
      </div>

      <DeleteConfirmModal
        open={showDelete}
        agentName={agent.name}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
