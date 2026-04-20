import type { Metadata } from "next";
import "@/styles.css";

export const metadata: Metadata = {
  title: "AgentHub - AI Agent Platform",
  description: "Create and manage AI agents with AgentHub",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
