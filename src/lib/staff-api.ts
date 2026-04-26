import { getApiErrorMessage, getApiSuccessData } from "@/lib/error-message";

export interface StaffMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  assigned_agent_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface StaffCreateInput {
  name: string;
  email: string;
  role: string;
  assigned_agent_ids: string[];
}

export interface StaffUpdateInput {
  name?: string;
  email?: string;
  role?: string;
  assigned_agent_ids?: string[];
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

async function fetchStaffRequest(accessToken: string) {
  const response = await fetch("/backend/api/v1/staff", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load staff"));
  }

  return body as StaffMember[];
}

async function createStaffRequest(input: StaffCreateInput, accessToken: string) {
  const response = await fetch("/backend/api/v1/staff", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to create staff member"));
  }

  return getApiSuccessData<StaffMember>(body);
}

async function updateStaffRequest(staffId: string, input: StaffUpdateInput, accessToken: string) {
  const response = await fetch(`/backend/api/v1/staff/${staffId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to update staff member"));
  }

  return getApiSuccessData<StaffMember>(body);
}

async function deleteStaffRequest(staffId: string, accessToken: string) {
  const response = await fetch(`/backend/api/v1/staff/${staffId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, "Failed to delete staff member"));
  }
}

export async function fetchStaff(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withAuthRetry(fetchStaffRequest, accessToken, refreshAccessToken);
}

export async function createStaff(
  input: StaffCreateInput,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withAuthRetry(
    (token) => createStaffRequest(input, token),
    accessToken,
    refreshAccessToken,
  );
}

export async function updateStaff(
  staffId: string,
  input: StaffUpdateInput,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withAuthRetry(
    (token) => updateStaffRequest(staffId, input, token),
    accessToken,
    refreshAccessToken,
  );
}

export async function deleteStaff(
  staffId: string,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return withAuthRetry(
    (token) => deleteStaffRequest(staffId, token),
    accessToken,
    refreshAccessToken,
  );
}
