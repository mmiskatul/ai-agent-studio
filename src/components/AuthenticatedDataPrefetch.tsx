"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchBackendAgents,
  fetchBackendAllAgentResponsePages,
} from "@/lib/agent-api";
import { fetchDashboardOverview } from "@/lib/dashboard-api";
import { fetchProfile } from "@/lib/profile-api";
import { CHATS_ROUTE } from "@/lib/routes";
import { fetchTemplates } from "@/lib/template-api";

interface AuthenticatedDataPrefetchProps {
  accessToken: string | null;
  refreshAccessToken?: () => Promise<string | null>;
}

const ROUTES_TO_PREFETCH = ["/dashboard", CHATS_ROUTE, "/agents", "/profile"];

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

    void Promise.allSettled([
      fetchDashboardOverview(accessToken, refreshAccessToken),
      fetchBackendAgents(accessToken, refreshAccessToken),
      fetchBackendAllAgentResponsePages(accessToken, refreshAccessToken),
      fetchTemplates(accessToken, refreshAccessToken),
      fetchProfile(accessToken, refreshAccessToken),
    ]);
  }, [accessToken, refreshAccessToken, router]);

  return null;
}
