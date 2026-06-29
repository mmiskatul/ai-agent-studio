import { getApiErrorMessage } from "@/lib/error-message";
import { backendFetch } from "@/lib/backend-fetch";
import { getOrFetchSessionCached } from "@/lib/session-cache";

const fetch = backendFetch;

export interface DashboardStats {
  total_agents: number;
  active_agents: number;
  inactive_agents: number;
  recently_updated_agents: number;
  total_chats: number;
  total_messages: number;
  queries_30d: number;
}

export interface DashboardAgentSummary {
  id: string;
  name: string;
  role: string;
  status: string;
  category: string;
  queries_30d: number;
  updated_at: string;
}

export interface DashboardCategorySummary {
  name: string;
  count: number;
}

export interface DashboardActivityItem {
  type: string;
  title: string;
  description: string;
  created_at: string;
}

export interface DashboardOverview {
  stats: DashboardStats;
  top_agents: DashboardAgentSummary[];
  categories: DashboardCategorySummary[];
  recent_activity: DashboardActivityItem[];
}

export const DASHBOARD_OVERVIEW_CACHE_KEY = "dashboard-overview";
const DASHBOARD_OVERVIEW_CACHE_TTL_MS = 30_000;

async function withDashboardAuthRetry<T>(
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

async function fetchDashboardOverviewRequest(accessToken: string) {
  const response = await fetch("/backend/api/v1/dashboard", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Failed to load dashboard overview"));
  }

  return body as DashboardOverview;
}

export async function fetchDashboardOverview(
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  return getOrFetchSessionCached(
    DASHBOARD_OVERVIEW_CACHE_KEY,
    DASHBOARD_OVERVIEW_CACHE_TTL_MS,
    () => withDashboardAuthRetry(fetchDashboardOverviewRequest, accessToken, refreshAccessToken),
  );
}
