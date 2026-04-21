async function postGeneratedText<TBody extends Record<string, unknown>, TResponse>(
  path: string,
  body: TBody,
  accessToken: string,
) {
  const response = await fetch(`/backend/api/v1/agents/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(responseBody.detail || "Failed to generate content");
  }

  return responseBody as TResponse;
}

async function withUnauthorizedRetry<T>(
  request: (accessToken: string) => Promise<T>,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  try {
    return await request(accessToken);
  } catch (error) {
    if (!(error instanceof Error) || !refreshAccessToken) {
      throw error;
    }

    const message = error.message.toLowerCase();
    const isUnauthorized =
      message.includes("invalid bearer token") ||
      message.includes("missing bearer token") ||
      message.includes("unauthorized");

    if (!isUnauthorized) {
      throw error;
    }

    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      throw error;
    }

    return request(refreshedToken);
  }
}

export async function generateAgentDescription(
  name: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const response = await withUnauthorizedRetry(
    (token) =>
      postGeneratedText<{ name: string }, { short_description: string }>(
        "generate-description",
        { name },
        token,
      ),
    accessToken,
    refreshAccessToken,
  );

  return response.short_description;
}

export async function generateAgentSystemPrompt(
  input: {
    name: string;
    shortDescription: string;
    categoryTag?: string;
    baseTemplate?: string;
  },
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const response = await withUnauthorizedRetry(
    (token) =>
      postGeneratedText<
        {
          name: string;
          short_description: string;
          category_tag?: string;
          base_template?: string;
        },
        { system_prompt: string }
      >(
        "generate-system-prompt",
        {
          name: input.name,
          short_description: input.shortDescription,
          category_tag: input.categoryTag,
          base_template: input.baseTemplate,
        },
        token,
      ),
    accessToken,
    refreshAccessToken,
  );

  return response.system_prompt;
}

export async function generateAgentWelcomeMessage(
  input: {
    name: string;
    shortDescription: string;
    categoryTag?: string;
    baseTemplate?: string;
  },
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  const response = await withUnauthorizedRetry(
    (token) =>
      postGeneratedText<
        {
          name: string;
          short_description: string;
          category_tag?: string;
          base_template?: string;
        },
        { welcome_message: string }
      >(
        "generate-welcome-message",
        {
          name: input.name,
          short_description: input.shortDescription,
          category_tag: input.categoryTag,
          base_template: input.baseTemplate,
        },
        token,
      ),
    accessToken,
    refreshAccessToken,
  );

  return response.welcome_message;
}
