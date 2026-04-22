import type { Metadata } from "next";
import "@/styles.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "AgentHub - AI Agent Platform",
  description: "Create and manage AI agents with AgentHub",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
