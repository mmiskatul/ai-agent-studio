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
import { fetchProfile } from "@/lib/profile-api";
import { fetchTemplates } from "@/lib/template-api";

interface AuthenticatedDataPrefetchProps {
  accessToken: string | null;
  refreshAccessToken?: () => Promise<string | null>;
}

const ROUTES_TO_PREFETCH = ["/dashboard", "/agents", "/agents/new", "/profile"];

function scheduleBackgroundWork(work: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const runWhenIdle = window.requestIdleCallback as (callback: () => void) => number;
    runWhenIdle(work);
    return;
  }

  globalThis.setTimeout(work, 0);
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

    for (const route of ROUTES_TO_PREFETCH) {
      router.prefetch(route);
    }

    void fetchDashboardStats(accessToken, refreshAccessToken);

    scheduleBackgroundWork(() => {
      void Promise.allSettled([
        fetchDashboardTopAgents(accessToken, refreshAccessToken),
        fetchDashboardCategories(accessToken, refreshAccessToken),
        fetchDashboardRecentActivity(accessToken, refreshAccessToken),
        fetchBackendAgents(accessToken, refreshAccessToken),
        fetchTemplates(accessToken, refreshAccessToken),
        fetchProfile(accessToken, refreshAccessToken),
      ]);

      void fetchBackendAllAgentResponsePages(accessToken, refreshAccessToken).then((pages) => {
        const recentChats = pages.slice(0, 6).filter((page) => page.id && page.agent_id);
        void Promise.allSettled(
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
      });
    });
  }, [accessToken, refreshAccessToken, router]);

  return null;
}
