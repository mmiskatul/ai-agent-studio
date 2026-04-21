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

export async function fetchDashboardOverview(accessToken: string) {
  const response = await fetch("/backend/api/v1/dashboard", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to load dashboard overview");
  }

  return body as DashboardOverview;
}
