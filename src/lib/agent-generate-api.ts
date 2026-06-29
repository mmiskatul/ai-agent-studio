import { getApiErrorMessage } from "@/lib/error-message";
import { backendFetch } from "@/lib/backend-fetch";

const fetch = backendFetch;

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
    throw new Error(getApiErrorMessage(responseBody, "Failed to generate content"));
  }

  return responseBody as TResponse;
}

function buildDescriptionFallback(name: string, role?: string) {
  const cleanedName = name.trim() || "This agent";
  const loweredName = cleanedName.toLowerCase();
  const cleanedRole = role?.trim();

  if (/(sales|lead|outreach|revenue)/i.test(loweredName)) {
    return `${cleanedName} helps sales teams respond to buyer questions, handle objections, and move deals forward with clearer next steps. It is useful for drafting outreach, refining sales communication, and turning pipeline activity into practical follow-up actions.`;
  }

  if (/(support|help|service|customer)/i.test(loweredName)) {
    return `${cleanedName} helps support teams resolve customer issues faster with clear, practical responses. It is useful for troubleshooting problems, drafting replies, and guiding consistent customer communication across common service workflows.`;
  }

  if (/(data|analytics|report|insight)/i.test(loweredName)) {
    return `${cleanedName} helps teams analyze information, summarize findings, and turn data into actionable insights. It is useful for reporting, spotting patterns, and producing clear outputs that support better decisions.`;
  }

  if (cleanedRole) {
    return `${cleanedName} works as a ${cleanedRole} and helps users complete related tasks with clear, practical outputs. It is useful for answering questions, drafting responses, organizing information, and suggesting next steps that are ready to use in real workflows.`;
  }

  return `${cleanedName} helps users complete focused work with clear, practical outputs. It is useful for answering questions, organizing information, and producing responses that are ready to use in real workflows.`;
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
  role: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  try {
    const response = await withUnauthorizedRetry(
      (token) =>
        postGeneratedText<{ name: string; role: string }, { short_description: string }>(
          "generate-description",
          { name, role },
          token,
        ),
      accessToken,
      refreshAccessToken,
    );

    return response.short_description;
  } catch {
    return buildDescriptionFallback(name, role);
  }
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
