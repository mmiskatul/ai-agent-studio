export interface ProfileStats {
  total_agents: number;
  active_agents: number;
  inactive_agents: number;
  total_messages: number;
}

export interface ProfileLatestAgent {
  id: string;
  name: string;
  created_at: string;
}

export interface ProfileLatestConversation {
  chat_id: string;
  agent_id: string;
  agent_name: string;
  message_count: number;
  updated_at: string;
}

export interface ProfileResponse {
  id: string;
  email: string;
  display_name?: string | null;
  profile_image?: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
  updated_at: string;
  stats: ProfileStats;
  latest_agent?: ProfileLatestAgent | null;
  latest_conversation?: ProfileLatestConversation | null;
}

async function withProfileAuthRetry<T>(
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

async function fetchProfileRequest(accessToken: string) {
  const response = await fetch("/backend/api/v1/auth/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((body as { detail?: string }).detail || "Failed to load profile");
  }

  return body as ProfileResponse;
}

export async function fetchProfile(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withProfileAuthRetry(fetchProfileRequest, accessToken, refreshAccessToken);
}

async function updateProfileRequest(
  accessToken: string,
  input: { display_name?: string | null; profile_image?: string | null },
) {
  const response = await fetch("/backend/api/v1/auth/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((body as { detail?: string }).detail || "Failed to update profile");
  }

  return body as ProfileResponse;
}

export async function updateProfile(
  accessToken: string,
  input: { display_name?: string | null; profile_image?: string | null },
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withProfileAuthRetry(
    (token) => updateProfileRequest(token, input),
    accessToken,
    refreshAccessToken,
  );
}
