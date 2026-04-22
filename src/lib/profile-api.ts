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

export async function fetchProfile(accessToken: string) {
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

export async function updateProfile(
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
