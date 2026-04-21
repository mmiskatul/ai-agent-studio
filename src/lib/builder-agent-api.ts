export interface CreateBuilderAgentInput {
  name: string;
  shortDescription: string;
  baseTemplate: string;
  categoryTag?: string;
  systemPrompt: string;
  welcomeMessage?: string;
  llmEngine: string;
  temperature: number;
  status: string;
  uploadDataSource?: File | null;
}

function buildCreateBuilderAgentFormData(input: CreateBuilderAgentInput) {
  const formData = new FormData();
  formData.append("name", input.name);
  formData.append("short_description", input.shortDescription);
  formData.append("base_template", input.baseTemplate);
  formData.append("category_tag", input.categoryTag ?? "");
  formData.append("system_prompt", input.systemPrompt);
  formData.append("welcome_message", input.welcomeMessage ?? "");
  formData.append("llm_engine", input.llmEngine);
  formData.append("temperature", String(input.temperature));
  formData.append("status", input.status);

  if (input.uploadDataSource) {
    formData.append("upload_data_source", input.uploadDataSource);
  }

  return formData;
}

async function postBuilderAgent(input: CreateBuilderAgentInput, accessToken: string) {
  const response = await fetch("/backend/api/v1/agents/builder/with-knowledge", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: buildCreateBuilderAgentFormData(input),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to create agent");
  }

  return body;
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
