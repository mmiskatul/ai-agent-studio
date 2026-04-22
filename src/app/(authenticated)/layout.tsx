"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { useAuth } from "@/hooks/use-auth";
import { SIGN_IN_ROUTE } from "@/lib/routes";

export default function AuthenticatedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, sessionToken, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !sessionToken)) {
      router.replace(SIGN_IN_ROUTE);
    }
  }, [loading, router, sessionToken, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !sessionToken) return null;

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
