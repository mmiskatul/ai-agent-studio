import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User } from "lucide-react";

function getProfileInitial(email?: string) {
  return email?.trim().charAt(0).toUpperCase() || "U";
}

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div />
      <div className="flex items-center gap-3">
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
