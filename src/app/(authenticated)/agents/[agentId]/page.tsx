"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { fetchAgent, updateAgent, deleteAgent, type Agent } from "@/lib/agent-api";
import { AgentForm } from "@/components/AgentForm";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AUTHENTICATED_HOME } from "@/lib/routes";

export default function EditAgentPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const router = useRouter();
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
      router.push(AUTHENTICATED_HOME);
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
      router.push(AUTHENTICATED_HOME);
    } catch (err) {
      console.error("Failed to delete agent:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="space-y-5">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <div className="flex justify-end gap-3">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">{error || "Agent not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(AUTHENTICATED_HOME)}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Edit Agent</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-destructive"
          onClick={() => setShowDelete(true)}
        >
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
          onCancel={() => router.push(AUTHENTICATED_HOME)}
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
