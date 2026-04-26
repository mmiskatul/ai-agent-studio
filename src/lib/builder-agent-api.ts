import { getApiErrorMessage, getApiSuccessData } from "@/lib/error-message";
import type { Agent } from "@/lib/agent-api";

export interface CreateBuilderAgentInput {
  name: string;
  shortDescription: string;
  baseTemplate: string;
  categoryTag?: string;
  systemPrompt: string;
  welcomeMessage?: string;
  temperature: number;
  status: string;
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
      temperature: input.temperature,
      status: input.status,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to create agent"));
  }

  return getApiSuccessData<Agent>(body);
}

export async function createBuilderAgent(
  input: CreateBuilderAgentInput,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  try {
    return await postBuilderAgent(input, accessToken);
  } catch (error) {
    if (!(error instanceof Error) || !refreshAccessToken) {
      throw error;
    }

    const isUnauthorized =
      error.message.toLowerCase().includes("invalid bearer token") ||
      error.message.toLowerCase().includes("missing bearer token") ||
      error.message.toLowerCase().includes("unauthorized");

    if (!isUnauthorized) {
      throw error;
    }

    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      throw error;
    }

    return postBuilderAgent(input, refreshedToken);
  }
}
