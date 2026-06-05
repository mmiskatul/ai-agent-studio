"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AgentForm, type AgentFormValues } from "@/components/AgentForm";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { createBackendAgent } from "@/lib/agent-api";
import { getErrorMessage } from "@/lib/error-message";
import { AUTHENTICATED_HOME } from "@/lib/routes";
import { peekSessionCache } from "@/lib/session-cache";
import { buildStandardSystemPrompt } from "@/lib/standard-agent-prompt";
import { fetchTemplates, TEMPLATE_CACHE_KEY, type AgentTemplate } from "@/lib/template-api";

const NEW_AGENT_DRAFT_KEY = "agenthub.new-agent-draft";

export default function NewAgentPage() {
  const router = useRouter();
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const cachedTemplates = peekSessionCache<AgentTemplate[]>(TEMPLATE_CACHE_KEY);
  const [templates, setTemplates] = useState<AgentTemplate[]>(cachedTemplates ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(!cachedTemplates);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;

    async function loadTemplates() {
      const token = accessToken;
      if (!token) {
        setLoadingTemplates(false);
        return;
      }

      try {
        const data = await fetchTemplates(token, refreshAccessToken);
        setTemplates(data);
      } catch (err) {
        const message = getErrorMessage(err, "Failed to load templates.");
        setError(message);
        toast.error("Could not load templates", { description: message });
      } finally {
        setLoadingTemplates(false);
      }
    }

    void loadTemplates();
  }, [accessToken, authLoading, refreshAccessToken]);

  async function handleSubmit(values: AgentFormValues) {
    if (!accessToken) {
      const message = "Sign in again to save this agent.";
      setError(message);
      toast.error("Could not create agent", { description: message });
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    const selectedTemplate = templates.find((template) => template.id === values.templateId);

    try {
      const created = await createBackendAgent(
        {
          name: values.name,
          role: values.role,
          purpose: values.purpose,
          description: values.purpose,
          knowledge_text: values.knowledgeText || null,
          language: values.language,
          template_type: selectedTemplate?.key || null,
          template_id: values.templateId || null,
          system_prompt:
            selectedTemplate?.system_prompt ||
            buildStandardSystemPrompt({
              name: values.name,
              role: values.role,
              purpose: values.purpose,
              language: values.language,
              templateType: selectedTemplate?.key || "custom",
            }),
          welcome_message: null,
          status: values.status,
          tools: [],
          model: null,
          temperature: 0.7,
          routing_keywords: [],
          priority: 100,
          is_active: values.status === "enabled",
          user_id: "",
          owner_user_id: "",
        },
        accessToken,
        refreshAccessToken,
      );

      setSuccessMessage("Agent created successfully.");
      toast.success("Agent created", { description: `${created.name} is ready.` });
      router.push("/agents");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to create agent.");
      setError(message);
      toast.error("Could not create agent", { description: message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Agent</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Set up a new AI agent and save it permanently to your workspace.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(AUTHENTICATED_HOME)}>
          Back
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {error ? (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {loadingTemplates ? (
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        ) : (
          <AgentForm
            templates={templates}
            onSubmit={handleSubmit}
            onCancel={() => router.push(AUTHENTICATED_HOME)}
            submitLabel="Create Agent"
            isSubmitting={isSaving}
            accessToken={accessToken}
            refreshAccessToken={refreshAccessToken}
            draftStorageKey={NEW_AGENT_DRAFT_KEY}
          />
        )}
      </div>
    </div>
  );
}
