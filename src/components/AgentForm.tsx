"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadAgentKnowledgeFile } from "@/lib/agent-api";
import { generateAgentDescription } from "@/lib/agent-generate-api";
import { getApiFieldErrors, getErrorMessage } from "@/lib/error-message";
import type { AgentTemplate } from "@/lib/template-api";

export interface AgentFormValues {
  name: string;
  role: string;
  purpose: string;
  knowledgeText: string;
  language: "EN" | "DE" | "RU";
  status: "enabled" | "disabled";
  templateId: string;
}

interface AgentFormProps {
  initialValues?: Partial<AgentFormValues>;
  templates?: AgentTemplate[];
  templatesLoading?: boolean;
  onTemplateFocus?: () => void;
  onSubmit: (values: AgentFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  accessToken?: string | null;
  refreshAccessToken?: () => Promise<string | null>;
  draftStorageKey?: string;
}

const defaultValues: AgentFormValues = {
  name: "",
  role: "",
  purpose: "",
  knowledgeText: "",
  language: "EN",
  status: "enabled",
  templateId: "",
};

const allowedLanguages = new Set<AgentFormValues["language"]>(["EN", "DE", "RU"]);
const allowedStatuses = new Set<AgentFormValues["status"]>(["enabled", "disabled"]);
const MAX_KNOWLEDGE_FILES = 10;
const MAX_KNOWLEDGE_FILE_BYTES = 25 * 1024 * 1024;

function resolveFormValues(
  initialValues?: Partial<AgentFormValues>,
  draftStorageKey?: string,
): AgentFormValues {
  const baseValues = {
    ...defaultValues,
    ...initialValues,
  };

  if (typeof window === "undefined" || !draftStorageKey) {
    return baseValues;
  }

  const rawDraft = window.localStorage.getItem(draftStorageKey);
  if (!rawDraft) {
    return baseValues;
  }

  try {
    const parsedDraft = JSON.parse(rawDraft) as Partial<AgentFormValues>;
    return {
      ...baseValues,
      ...parsedDraft,
    };
  } catch {
    window.localStorage.removeItem(draftStorageKey);
    return baseValues;
  }
}

export function AgentForm({
  initialValues,
  templates = [],
  templatesLoading = false,
  onTemplateFocus,
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitting,
  accessToken,
  refreshAccessToken,
  draftStorageKey,
}: AgentFormProps) {
  const [values, setValues] = useState<AgentFormValues>(() =>
    resolveFormValues(initialValues, draftStorageKey),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);
  const [uploadedKnowledgeFiles, setUploadedKnowledgeFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draftStorageKey) {
      return;
    }
    setValues(resolveFormValues(initialValues));
  }, [draftStorageKey, initialValues]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftStorageKey) return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify(values));
  }, [draftStorageKey, values]);

  function updateValue<Key extends keyof AgentFormValues>(key: Key, value: AgentFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError("");
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function applyTemplate(templateId: string) {
    updateValue("templateId", templateId);
    const selectedTemplate = templates.find((template) => template.id === templateId);
    if (!selectedTemplate) return;

    setValues((current) => ({
      ...current,
      templateId,
      name: current.name.trim() ? current.name : selectedTemplate.name,
      role: current.role.trim() ? current.role : selectedTemplate.role,
      purpose: current.purpose.trim() ? current.purpose : selectedTemplate.description,
      language: current.language || selectedTemplate.language,
    }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!values.name.trim()) nextErrors.name = "Agent name is required.";
    if (!values.role.trim()) nextErrors.role = "Role is required.";
    if (!values.purpose.trim()) nextErrors.purpose = "Purpose is required.";
    if (!allowedLanguages.has(values.language)) nextErrors.language = "Select a valid language.";
    if (!allowedStatuses.has(values.status)) nextErrors.status = "Select a valid status.";
    if (
      values.templateId &&
      templates.length > 0 &&
      !templates.some((template) => template.id === values.templateId)
    ) {
      nextErrors.templateId = "Select a valid template.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;

    const payload = {
      name: values.name.trim(),
      role: values.role.trim(),
      purpose: values.purpose.trim(),
      knowledgeText: values.knowledgeText.trim(),
      language: values.language,
      status: values.status,
      templateId: values.templateId,
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      const nextErrors = getApiFieldErrors(error instanceof Error ? (error as Error & { detail?: unknown }).detail : undefined);
      if (Object.keys(nextErrors).length > 0) {
        setErrors((current) => ({ ...current, ...nextErrors }));
      }
      setFormError(getErrorMessage(error, "Failed to save agent."));
      return;
    }

    if (typeof window !== "undefined" && draftStorageKey) {
      window.localStorage.removeItem(draftStorageKey);
    }
  }

  async function handleGenerateDescription() {
    const trimmedName = values.name.trim();
    const trimmedRole = values.role.trim();
    const nextErrors: Record<string, string> = {};

    if (!trimmedName) nextErrors.name = "Enter the agent name first.";
    if (!trimmedRole) nextErrors.role = "Enter the role first.";
    if (!accessToken) nextErrors.purpose = "Sign in again to generate a purpose.";

    if (Object.keys(nextErrors).length > 0) {
      setFormError("");
      setErrors((current) => ({ ...current, ...nextErrors }));
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const purpose = await generateAgentDescription(
        trimmedName,
        trimmedRole,
        accessToken as string,
        refreshAccessToken,
      );
      updateValue("purpose", purpose);
    } catch (error) {
      setFormError(getErrorMessage(error, "Failed to generate purpose."));
      toast.error("Could not generate purpose", {
        description: getErrorMessage(error, "Failed to generate purpose."),
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  }

  async function handleKnowledgeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const remainingSlots = MAX_KNOWLEDGE_FILES - uploadedKnowledgeFiles.length;
    if (remainingSlots <= 0) {
      const message = `You can upload a maximum of ${MAX_KNOWLEDGE_FILES} documents.`;
      setFormError(message);
      toast.error("Upload limit reached", { description: message });
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    const skippedCount = files.length - filesToUpload.length;
    const oversizedFiles = filesToUpload.filter((file) => file.size > MAX_KNOWLEDGE_FILE_BYTES);
    const validFiles = filesToUpload.filter((file) => file.size <= MAX_KNOWLEDGE_FILE_BYTES);

    if (oversizedFiles.length > 0) {
      const message = "Each document must be 25 MB or smaller.";
      setFormError(message);
      toast.error("Document is too large", { description: message });
    }
    if (!accessToken || validFiles.length === 0) {
      setErrors((current) => ({ ...current, knowledgeText: "Sign in again to upload knowledge." }));
      return;
    }

    setIsUploadingKnowledge(true);
    try {
      const extractedTexts: string[] = [];
      const uploadedNames: string[] = [];
      const failedNames: string[] = [];

      for (const file of validFiles) {
        try {
          const result = await uploadAgentKnowledgeFile(file, accessToken, refreshAccessToken);
          extractedTexts.push(result.extracted_text);
          uploadedNames.push(file.name);
        } catch {
          failedNames.push(file.name);
        }
      }

      if (extractedTexts.length > 0) {
        const extractedText = extractedTexts.join("\n\n");
        updateValue("knowledgeText", values.knowledgeText.trim()
          ? `${values.knowledgeText.trim()}\n\n${extractedText}`
          : extractedText);
      }
      setUploadedKnowledgeFiles((current) => [...current, ...uploadedNames]);

      if (skippedCount > 0) {
        toast.error("Upload limit reached", {
          description: `${skippedCount} file${skippedCount === 1 ? " was" : "s were"} skipped. You can upload a maximum of ${MAX_KNOWLEDGE_FILES} documents.`,
        });
      }
      if (failedNames.length > 0) {
        const message = `Could not upload: ${failedNames.join(", ")}`;
        setFormError(message);
        toast.error("Some files could not be uploaded", { description: message });
      }
    } catch (error) {
      setErrors((current) => ({
        ...current,
        knowledgeText: getErrorMessage(error, "Failed to upload knowledge."),
      }));
      setFormError(getErrorMessage(error, "Failed to upload knowledge."));
      toast.error("Could not upload knowledge", {
        description: getErrorMessage(error, "Failed to upload knowledge."),
      });
    } finally {
      setIsUploadingKnowledge(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {Object.keys(errors).length > 0 ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Please fix the following errors:</p>
          <ul className="mt-2 list-disc pl-5">
            {Object.entries(errors).map(([field, message]) => (
              <li key={`${field}-${message}`}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="agent-name">Name *</Label>
          <Input
            id="agent-name"
            value={values.name}
            onChange={(event) => updateValue("name", event.target.value)}
            placeholder="Sales Assistant"
            className="mt-1"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
        </div>

        <div>
          <Label htmlFor="agent-role">Role *</Label>
          <Input
            id="agent-role"
            value={values.role}
            onChange={(event) => updateValue("role", event.target.value)}
            placeholder="Lead response specialist"
            className="mt-1"
            aria-invalid={Boolean(errors.role)}
          />
          {errors.role ? <p className="mt-1 text-xs text-destructive">{errors.role}</p> : null}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="agent-purpose">Purpose *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleGenerateDescription}
            disabled={isSubmitting || isGeneratingDescription}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isGeneratingDescription ? "Generating..." : "Generate Purpose with AI"}
          </Button>
        </div>
        <Textarea
          id="agent-purpose"
          value={values.purpose}
          onChange={(event) => updateValue("purpose", event.target.value)}
          placeholder="Explain what this agent should do and how it should help users."
          rows={4}
          className="mt-1"
          aria-invalid={Boolean(errors.purpose)}
        />
        {errors.purpose ? (
          <p className="mt-1 text-xs text-destructive">{errors.purpose}</p>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="agent-knowledge">Knowledge Base</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              id="agent-knowledge-file"
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff"
              className="hidden"
              onChange={handleKnowledgeUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || isUploadingKnowledge || !accessToken}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {isUploadingKnowledge ? "Uploading..." : "Upload files"}
            </Button>
          </div>
        </div>
        <Textarea
          id="agent-knowledge"
          value={values.knowledgeText}
          onChange={(event) => updateValue("knowledgeText", event.target.value)}
          placeholder="Optional uploaded or pasted knowledge for this agent."
          rows={6}
          className="mt-1"
          aria-invalid={Boolean(errors.knowledgeText)}
        />
        {errors.knowledgeText ? (
          <p className="mt-1 text-xs text-destructive">{errors.knowledgeText}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          Up to 10 documents, 25 MB each. Supported: PDF, text, and common image formats. AI-extracted content is combined and stored on the agent.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="agent-language">Language</Label>
          <select
            id="agent-language"
            value={values.language}
            onChange={(event) =>
              updateValue("language", event.target.value as AgentFormValues["language"])
            }
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            aria-invalid={Boolean(errors.language)}
          >
            <option value="EN">English</option>
            <option value="DE">German</option>
            <option value="RU">Russian</option>
          </select>
          {errors.language ? (
            <p className="mt-1 text-xs text-destructive">{errors.language}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="agent-status">Status</Label>
          <select
            id="agent-status"
            value={values.status}
            onChange={(event) =>
              updateValue("status", event.target.value as AgentFormValues["status"])
            }
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            aria-invalid={Boolean(errors.status)}
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          {errors.status ? <p className="mt-1 text-xs text-destructive">{errors.status}</p> : null}
        </div>

        <div>
          <Label htmlFor="agent-template">Template</Label>
          <select
            id="agent-template"
            value={values.templateId}
            onChange={(event) => applyTemplate(event.target.value)}
            onFocus={onTemplateFocus}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            aria-invalid={Boolean(errors.templateId)}
          >
            <option value="">Custom</option>
            {templatesLoading ? <option value="" disabled>Loading templates...</option> : null}
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          {errors.templateId ? (
            <p className="mt-1 text-xs text-destructive">{errors.templateId}</p>
          ) : templatesLoading ? (
            <p className="mt-1 text-xs text-muted-foreground">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Templates load when you open this field.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
      {draftStorageKey ? (
        <p className="text-xs text-muted-foreground">
          Draft is saved in this browser and restored after reload.
        </p>
      ) : null}
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
    </form>
  );
}
