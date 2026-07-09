import { withUnauthorizedRetry } from "@/lib/backend-auth";
import { getApiErrorMessage } from "@/lib/error-message";
import { backendFetch } from "@/lib/backend-fetch";
import { getOrFetchSessionCached, peekSessionCache } from "@/lib/session-cache";

const fetch = backendFetch;

export interface AgentTemplate {
  id: string;
  key: string;
  label: string;
  name: string;
  role: string;
  description: string;
  language: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
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

export async function fetchTemplates(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  try {
    return await getOrFetchSessionCached(TEMPLATE_CACHE_KEY, TEMPLATE_CACHE_TTL_MS, () =>
      withUnauthorizedRetry(fetchTemplatesRequest, accessToken, refreshAccessToken),
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
