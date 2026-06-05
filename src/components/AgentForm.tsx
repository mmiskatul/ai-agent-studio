"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadAgentKnowledgeFile } from "@/lib/agent-api";
import { generateAgentDescription } from "@/lib/agent-generate-api";
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
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);
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
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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

    await onSubmit(payload);

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
    } finally {
      setIsGeneratingDescription(false);
    }
  }

  async function handleKnowledgeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;

    setIsUploadingKnowledge(true);
    try {
      const result = await uploadAgentKnowledgeFile(file, accessToken, refreshAccessToken);
      updateValue("knowledgeText", result.extracted_text);
    } finally {
      setIsUploadingKnowledge(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="agent-name">Name *</Label>
          <Input
            id="agent-name"
            value={values.name}
            onChange={(event) => updateValue("name", event.target.value)}
            placeholder="Sales Assistant"
            className="mt-1"
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
              accept=".pdf,.txt,.md,.csv,.json"
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
              {isUploadingKnowledge ? "Uploading..." : "Upload PDF/Text"}
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
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Supported: PDF, TXT, MD, CSV, JSON. Uploaded text is stored on the agent and used in chat.
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
          >
            <option value="EN">English</option>
            <option value="DE">German</option>
            <option value="RU">Russian</option>
          </select>
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
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div>
          <Label htmlFor="agent-template">Template</Label>
          <select
            id="agent-template"
            value={values.templateId}
            onChange={(event) => applyTemplate(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Custom</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
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
    </form>
  );
}
