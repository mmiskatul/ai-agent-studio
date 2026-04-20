import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, User } from "lucide-react";

function getProfileInitial(email?: string) {
  return email?.trim().charAt(0).toUpperCase() || "U";
}

export function TopBar() {
  const { user } = useAuth();
  const notifications = [
    {
      title: "Agent ready",
      description: "Your latest agent is ready for testing.",
      time: "Now",
    },
    {
      title: "New chat activity",
      description: "A user message was added to an agent chat.",
      time: "12m",
    },
  ];

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div />
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-full"
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-2">
            <DropdownMenuLabel className="px-2 py-2">
              <p className="text-sm font-bold text-foreground">Notifications</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Recent workspace activity
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.title} className="block cursor-pointer px-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {notification.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {notification.time}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/notifications" className="w-full justify-center font-medium">
                View all notifications
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full p-0"
              aria-label="Open profile menu"
            >
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                  {getProfileInitial(user?.email)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2">
            <DropdownMenuLabel className="px-2 py-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Signed in as</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/profile" className="w-full">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
