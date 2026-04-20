"use client";

import { Bell, CheckCircle2, MessageCircle, Sparkles } from "lucide-react";

const notifications = [
  {
    title: "Agent ready for testing",
    description:
      "Your latest agent is configured and can be tested from the Testing Message drawer.",
    time: "Now",
    icon: Sparkles,
  },
  {
    title: "New chat activity",
    description: "A new user message was added to one of your agent conversations.",
    time: "12 minutes ago",
    icon: MessageCircle,
  },
  {
    title: "Workspace synced",
    description: "Agent status and dashboard metrics were updated successfully.",
    time: "Today",
    icon: CheckCircle2,
  },
];

export default function NotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Review recent account, agent, and chat updates.
          </p>
        </div>
      </div>

      <section className="agent-card overflow-hidden">
        {notifications.map((notification, index) => (
          <div
            key={notification.title}
            className={`flex items-start gap-4 px-5 py-5 ${
              index === notifications.length - 1 ? "" : "border-b border-border"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <notification.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-sm font-bold text-foreground">{notification.title}</h2>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {notification.time}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{notification.description}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
