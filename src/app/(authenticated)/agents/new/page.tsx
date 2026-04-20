"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createAgent } from "@/lib/agent-api";
import { AgentForm } from "@/components/AgentForm";
import { AUTHENTICATED_HOME } from "@/lib/routes";

export default function NewAgentPage() {
  const router = useRouter();
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
      router.push(AUTHENTICATED_HOME);
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
          onCancel={() => router.push(AUTHENTICATED_HOME)}
          submitLabel="Create Agent"
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
