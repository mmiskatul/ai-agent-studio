import { withUnauthorizedRetry } from "@/lib/backend-auth";
import { getApiErrorMessage, getApiSuccessData } from "@/lib/error-message";
import { backendFetch } from "@/lib/backend-fetch";
import { normalizeAgent, type Agent } from "@/lib/agent-api";

const fetch = backendFetch;

export interface CreateBuilderAgentInput {
  name: string;
  shortDescription: string;
  baseTemplate: string;
  categoryTag?: string;
  systemPrompt: string;
  welcomeMessage?: string;
  llmEngine?: string;
  temperature: number;
  status: "enabled" | "disabled";
}

async function postBuilderAgent(input: CreateBuilderAgentInput, accessToken: string) {
  const response = await fetch("/backend/api/v1/agents/builder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: input.name,
      short_description: input.shortDescription,
      base_template: input.baseTemplate,
      category_tag: input.categoryTag ?? null,
      system_prompt: input.systemPrompt,
      welcome_message: input.welcomeMessage ?? null,
      llm_engine: input.llmEngine ?? "gpt-4o",
      temperature: input.temperature,
      status: input.status,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to create agent"));
  }

  return normalizeAgent(getApiSuccessData<Agent>(body));
}

export async function createBuilderAgent(
  input: CreateBuilderAgentInput,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withUnauthorizedRetry(
    (token) => postBuilderAgent(input, token),
    accessToken,
    refreshAccessToken,
  );
}
