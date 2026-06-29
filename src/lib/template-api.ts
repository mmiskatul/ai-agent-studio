import { getApiErrorMessage } from "@/lib/error-message";
import { getOrFetchSessionCached, peekSessionCache } from "@/lib/session-cache";

export interface AgentTemplate {
  id: string;
  key: string;
  label: string;
  name: string;
  role: string;
  description: string;
  language: string;
  system_prompt: string;
}

async function fetchTemplatesRequest(accessToken: string) {
  const response = await fetch("/backend/api/v1/templates", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load templates"));
  }

  return body as AgentTemplate[];
}

export const TEMPLATE_CACHE_KEY = "templates";
const TEMPLATE_CACHE_TTL_MS = 45_000;

async function withAuthRetry<T>(
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

export async function fetchTemplates(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  try {
    return await getOrFetchSessionCached(TEMPLATE_CACHE_KEY, TEMPLATE_CACHE_TTL_MS, () =>
      withAuthRetry(fetchTemplatesRequest, accessToken, refreshAccessToken),
    );
  } catch (error) {
    const staleTemplates = peekSessionCache<AgentTemplate[]>(TEMPLATE_CACHE_KEY, {
      allowExpired: true,
    });
    if (staleTemplates?.length) {
      return staleTemplates;
    }
    throw error;
  }
}
