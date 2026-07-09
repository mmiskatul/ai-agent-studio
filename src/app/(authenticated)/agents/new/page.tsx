"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AgentForm, type AgentFormValues } from "@/components/AgentForm";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { createBackendAgent } from "@/lib/agent-api";
import { getErrorMessage } from "@/lib/error-message";
import { AUTHENTICATED_HOME, buildAgentRoute } from "@/lib/routes";
import { peekSessionCache } from "@/lib/session-cache";
import { buildStandardSystemPrompt } from "@/lib/standard-agent-prompt";
import { fetchTemplates, TEMPLATE_CACHE_KEY, type AgentTemplate } from "@/lib/template-api";

const NEW_AGENT_DRAFT_KEY = "agenthub.new-agent-draft";

export default function NewAgentPage() {
  const router = useRouter();
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const cachedTemplates = peekSessionCache<AgentTemplate[]>(TEMPLATE_CACHE_KEY, {
    allowExpired: true,
  });
  const [templates, setTemplates] = useState<AgentTemplate[]>(cachedTemplates ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const ensureTemplatesLoaded = useCallback(async () => {
    if (templates.length > 0 || authLoading || !accessToken) {
      return templates;
    }

    setLoadingTemplates(true);
    try {
      const data = await fetchTemplates(accessToken, refreshAccessToken);
      setTemplates(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load templates.");
      setError(message);
      toast.error("Could not load templates", { description: message });
      throw err;
    } finally {
      setLoadingTemplates(false);
    }
  }, [accessToken, authLoading, refreshAccessToken, templates]);

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

    try {
      const availableTemplates =
        values.templateId && templates.length === 0 ? await ensureTemplatesLoaded() : templates;
      const selectedTemplate = availableTemplates.find((template) => template.id === values.templateId);

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
          category_tag: null,
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
          llm_engine: "gpt-4o",
          status: values.status,
          tools: [],
          model: null,
          temperature: 0.7,
          routing_keywords: [],
          priority: 100,
          is_active: values.status === "enabled",
        },
        accessToken,
        refreshAccessToken,
      );

      setSuccessMessage("Agent created successfully.");
      toast.success("Agent created", { description: `${created.name} is ready.` });
      router.push(created.id ? buildAgentRoute(created.id) : "/agents");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to create agent.");
      setError(message);
      toast.error("Could not create agent", { description: message });
      throw err;
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

        <AgentForm
          templates={templates}
          templatesLoading={loadingTemplates}
          onTemplateFocus={() => {
            void ensureTemplatesLoaded();
          }}
          onSubmit={handleSubmit}
          onCancel={() => router.push(AUTHENTICATED_HOME)}
          submitLabel="Create Agent"
          isSubmitting={isSaving}
          accessToken={accessToken}
          refreshAccessToken={refreshAccessToken}
          draftStorageKey={NEW_AGENT_DRAFT_KEY}
        />
      </div>
    </div>
  );
}
