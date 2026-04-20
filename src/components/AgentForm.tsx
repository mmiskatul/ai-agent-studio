import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AgentFormProps {
  initialValues?: {
    name: string;
    role: string;
    purpose: string;
    templateType: string;
    systemPrompt: string;
    status: string;
  };
  onSubmit: (values: {
    name: string;
    role: string;
    purpose: string;
    template_type: string;
    system_prompt: string;
    status: string;
  }) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  isSubmitting: boolean;
}

export function AgentForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitting,
}: AgentFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [role, setRole] = useState(initialValues?.role ?? "");
  const [purpose, setPurpose] = useState(initialValues?.purpose ?? "");
  const [templateType, setTemplateType] = useState(initialValues?.templateType ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initialValues?.systemPrompt ?? "");
  const [status, setStatus] = useState(initialValues?.status ?? "active");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Agent name is required";
    if (!role.trim()) errs.role = "Role is required";
    if (!purpose.trim()) errs.purpose = "Purpose is required";
    if (!systemPrompt.trim()) errs.systemPrompt = "System instructions are required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      name: name.trim(),
      role: role.trim(),
      purpose: purpose.trim(),
      template_type: templateType,
      system_prompt: systemPrompt.trim(),
      status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Agent Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Agent"
            className="mt-1"
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>
        <div>
          <Label htmlFor="role">Role *</Label>
          <Input
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Customer Support Specialist"
            className="mt-1"
          />
          {errors.role && <p className="mt-1 text-xs text-destructive">{errors.role}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="purpose">Purpose *</Label>
        <Textarea
          id="purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Describe what this agent does..."
          rows={2}
          className="mt-1"
        />
        {errors.purpose && <p className="mt-1 text-xs text-destructive">{errors.purpose}</p>}
      </div>

      <div>
        <Label htmlFor="systemPrompt">System Instructions *</Label>
        <Textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Define how the agent should behave..."
          rows={6}
          className="mt-1 font-mono text-sm"
        />
        {errors.systemPrompt && (
          <p className="mt-1 text-xs text-destructive">{errors.systemPrompt}</p>
        )}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
