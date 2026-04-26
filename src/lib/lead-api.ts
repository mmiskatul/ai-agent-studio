import { getApiErrorMessage, getApiSuccessData } from "@/lib/error-message";

export interface Lead {
  id: string;
  agent_id: string;
  user_id: string;
  name: string;
  phone: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface LeadCreateInput {
  agent_id: string;
  name: string;
  phone: string;
  message: string;
}

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

async function fetchLeadsRequest(accessToken: string) {
  const response = await fetch("/backend/api/v1/leads", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load leads"));
  }

  return body as Lead[];
}

async function createLeadRequest(input: LeadCreateInput, accessToken: string) {
  const response = await fetch("/backend/api/v1/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to save lead"));
  }

  return getApiSuccessData<Lead>(body);
}

export async function fetchLeads(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withAuthRetry(fetchLeadsRequest, accessToken, refreshAccessToken);
}

export async function createLead(
  input: LeadCreateInput,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withAuthRetry((token) => createLeadRequest(input, token), accessToken, refreshAccessToken);
}
