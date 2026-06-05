"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AgentForm, type AgentFormValues } from "@/components/AgentForm";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteBackendAgent,
  fetchBackendAgent,
  updateBackendAgent,
  type Agent,
} from "@/lib/agent-api";
import { getErrorMessage } from "@/lib/error-message";
import { AUTHENTICATED_HOME } from "@/lib/routes";
import { buildStandardSystemPrompt } from "@/lib/standard-agent-prompt";
import { fetchTemplates, type AgentTemplate } from "@/lib/template-api";

export default function EditAgentPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const router = useRouter();
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const knowledgeText = agent?.knowledge_text?.trim() || "";
  const knowledgePreview =
    knowledgeText.length > 280 ? `${knowledgeText.slice(0, 280).trim()}...` : knowledgeText;

  useEffect(() => {
    if (authLoading) return;

    async function loadData() {
      const token = accessToken;
      if (!token) {
        const message = "Sign in again to load this agent.";
        setError(message);
        toast.error("Could not load agent", { description: message });
        setLoading(false);
        return;
      }

      try {
        const [agentData, templateData] = await Promise.all([
          fetchBackendAgent(agentId, token, refreshAccessToken),
          fetchTemplates(token, refreshAccessToken),
        ]);
        setAgent(agentData);
        setTemplates(templateData);
        setError("");
      } catch (err) {
        const message = getErrorMessage(err, "Agent not found");
        setError(message);
        toast.error("Could not load agent", { description: message });
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [accessToken, agentId, authLoading, refreshAccessToken]);

  async function handleSubmit(values: AgentFormValues) {
    if (!accessToken || !agent) return;

    setIsSubmitting(true);
    setError("");
    try {
      const selectedTemplate = templates.find((template) => template.id === values.templateId);
      await updateBackendAgent(
        agentId,
        {
          name: values.name,
          role: values.role,
          purpose: values.purpose,
          description: values.purpose,
          knowledge_text: values.knowledgeText || null,
          language: values.language,
          status: values.status,
          template_type: selectedTemplate?.key || agent.template_type,
          template_id: values.templateId || null,
          system_prompt:
            agent.system_prompt ||
            selectedTemplate?.system_prompt ||
            buildStandardSystemPrompt({
              name: values.name,
              role: values.role,
              purpose: values.purpose,
              language: values.language,
              templateType: selectedTemplate?.key || "custom",
            }),
          is_active: values.status === "enabled",
        },
        accessToken,
        refreshAccessToken,
      );
      toast.success("Agent updated");
      router.push("/agents");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to update agent");
      setError(message);
      toast.error("Could not update agent", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!accessToken) return;

    setIsDeleting(true);
    setError("");
    try {
      await deleteBackendAgent(agentId, accessToken, refreshAccessToken);
      toast.success("Agent deleted");
      router.push(AUTHENTICATED_HOME);
    } catch (err) {
      const message = getErrorMessage(err, "Failed to delete agent");
      setError(message);
      toast.error("Could not delete agent", { description: message });
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
        {error ? (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}
        <div className="mb-6 rounded-lg border border-border bg-background/60 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Uploaded Knowledge</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {knowledgeText
                  ? `${knowledgeText.length} characters stored for this agent`
                  : "No uploaded knowledge stored yet"}
              </p>
            </div>
          </div>
          {knowledgePreview ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {knowledgePreview}
            </p>
          ) : null}
        </div>
        <AgentForm
          initialValues={{
            name: agent.name,
            role: agent.role,
            purpose: agent.description || agent.purpose,
            knowledgeText: agent.knowledge_text ?? "",
            language: agent.language,
            templateId: agent.template_id ?? "",
            status: agent.status,
          }}
          templates={templates}
          onSubmit={handleSubmit}
          onCancel={() => router.push(AUTHENTICATED_HOME)}
          submitLabel="Save Changes"
          isSubmitting={isSubmitting}
          accessToken={accessToken}
          refreshAccessToken={refreshAccessToken}
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
