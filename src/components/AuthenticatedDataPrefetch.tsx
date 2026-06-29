"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchBackendAgents,
  fetchBackendAllAgentResponsePages,
} from "@/lib/agent-api";
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
        fetchBackendAllAgentResponsePages(accessToken, refreshAccessToken),
        fetchTemplates(accessToken, refreshAccessToken),
        fetchProfile(accessToken, refreshAccessToken),
      ]);
    });
  }, [accessToken, refreshAccessToken, router]);

  return null;
}
