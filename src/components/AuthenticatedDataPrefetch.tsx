"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchBackendAgents,
  fetchBackendAllAgentResponsePages,
  fetchBackendAgentResponseWorkspace,
} from "@/lib/agent-api";
import { primeWorkspaceSnapshot } from "@/lib/chat-workspace-cache";
import {
  fetchDashboardCategories,
  fetchDashboardRecentActivity,
  fetchDashboardStats,
  fetchDashboardTopAgents,
} from "@/lib/dashboard-api";
import {
  CHAT_WORKSPACE_PRELOAD_DELAY_MS,
  CHAT_WORKSPACE_PRELOAD_LIMIT,
  PRELOAD_ROUTES,
  scheduleDelayedTask,
  scheduleIdleTask,
} from "@/lib/frontend-preload";
import { fetchProfile } from "@/lib/profile-api";
import { fetchTemplates } from "@/lib/template-api";

interface AuthenticatedDataPrefetchProps {
  accessToken: string | null;
  refreshAccessToken?: () => Promise<string | null>;
}

export function AuthenticatedDataPrefetch({
  accessToken,
  refreshAccessToken,
}: AuthenticatedDataPrefetchProps) {
  const router = useRouter();
  const warmedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken || warmedTokenRef.current === accessToken) return;

    warmedTokenRef.current = accessToken;

    for (const route of PRELOAD_ROUTES) {
      router.prefetch(route);
    }

    void fetchDashboardStats(accessToken, refreshAccessToken);

    const cancelIdlePrefetch = scheduleIdleTask(() => {
      void Promise.allSettled([
        fetchDashboardTopAgents(accessToken, refreshAccessToken),
        fetchDashboardCategories(accessToken, refreshAccessToken),
        fetchDashboardRecentActivity(accessToken, refreshAccessToken),
        fetchBackendAgents(accessToken, refreshAccessToken),
        fetchTemplates(accessToken, refreshAccessToken),
        fetchProfile(accessToken, refreshAccessToken),
      ]);
    });

    const cancelChatWarmup = scheduleDelayedTask(CHAT_WORKSPACE_PRELOAD_DELAY_MS, () => {
      void fetchBackendAllAgentResponsePages(accessToken, refreshAccessToken)
        .then((pages) => {
          const recentChats = pages
            .filter((page) => page.id && page.agent_id)
            .slice(0, CHAT_WORKSPACE_PRELOAD_LIMIT);

          return Promise.allSettled(
            recentChats.map((page) =>
              fetchBackendAgentResponseWorkspace(
                page.agent_id,
                page.id,
                accessToken,
                refreshAccessToken,
              ).then((workspace) => {
                primeWorkspaceSnapshot(
                  workspace.agent,
                  workspace.pages,
                  workspace.chat_id,
                  workspace.messages,
                  workspace.memory_summary,
                  workspace.has_more_messages,
                  workspace.total_message_count,
                );
              }),
            ),
          );
        })
        .catch(() => undefined);
    });

    return () => {
      cancelIdlePrefetch?.();
      cancelChatWarmup?.();
    };
  }, [accessToken, refreshAccessToken, router]);

  return null;
}
