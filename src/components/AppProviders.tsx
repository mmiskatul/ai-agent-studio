"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster richColors position="top-right" closeButton />
    </AuthProvider>
  );
}
