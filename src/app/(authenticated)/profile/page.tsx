"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Camera,
  CircleUserRound,
  ImagePlus,
  KeyRound,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { peekSessionCache } from "@/lib/session-cache";
import {
  fetchProfile,
  PROFILE_CACHE_KEY,
  type ProfileResponse,
  updateProfile,
  changePassword,
  logoutAllDevices,
} from "@/lib/profile-api";

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, accessToken, sessionToken, refreshAccessToken, signOut, loading: authLoading } =
    useAuth();
  const cachedProfile = peekSessionCache<ProfileResponse>(PROFILE_CACHE_KEY, {
    allowExpired: true,
  });
  const [profile, setProfile] = useState<ProfileResponse | null>(cachedProfile);
  const [loadingProfile, setLoadingProfile] = useState(!cachedProfile);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [profileImageInput, setProfileImageInput] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSigningOutDevices, setIsSigningOutDevices] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayName =
    displayNameInput.trim() ||
    profile?.display_name?.trim() ||
    user?.display_name?.trim() ||
    user?.email?.split("@")[0] ||
    "User";
  const profileImage = profileImageInput || profile?.profile_image || user?.profile_image || null;
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const latestAgent = profile?.latest_agent;
  const latestConversation = profile?.latest_conversation;

  useEffect(() => {
    if (authLoading) return;

    async function loadProfileStats() {
      if (!accessToken) {
        setLoadingProfile(false);
        return;
      }

      try {
        const data = await fetchProfile(accessToken, refreshAccessToken);
        setProfile(data);
        setDisplayNameInput(data.display_name ?? "");
        setProfileImageInput(data.profile_image ?? null);
      } catch (err) {
        console.error("Failed to load profile stats:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    void loadProfileStats();
  }, [accessToken, authLoading, refreshAccessToken]);

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    if (newPassword !== confirmPassword) {
      setSecurityMessage("New passwords do not match.");
      return;
    }
    setIsChangingPassword(true);
    setSecurityMessage(null);
    try {
      const result = await changePassword(accessToken, currentPassword, newPassword, refreshAccessToken);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecurityMessage(result.message);
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSignOutDevices() {
    if (!accessToken) return;
    setIsSigningOutDevices(true);
    setSecurityMessage(null);
    try {
      const result = await logoutAllDevices(accessToken, refreshAccessToken);
      setSecurityMessage(result.message + ". Signing you out now.");
      await signOut();
      router.replace("/sign-in");
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : "Failed to sign out other devices.");
    } finally {
      setIsSigningOutDevices(false);
    }
  }
  if (loadingProfile && !profile) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="mb-6">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>

        <section className="agent-card mb-6 p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-14 w-80 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="agent-card p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-12 w-36 rounded-lg" />
            </div>
          </section>
          <aside className="agent-card p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  async function handleProfileImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileImageInput(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile() {
    if (!accessToken) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const nextProfile = await updateProfile(
        accessToken,
        {
          display_name: displayNameInput.trim() || null,
          profile_image: profileImageInput,
        },
        refreshAccessToken,
      );
      setProfile(nextProfile);
      setDisplayNameInput(nextProfile.display_name ?? "");
      setProfileImageInput(nextProfile.profile_image ?? null);
      setSaveMessage("Profile updated.");
    } catch (err) {
      console.error("Failed to update profile:", err);
      setSaveMessage(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Manage your account details and workspace activity.
        </p>
      </div>

      <section className="agent-card mb-6 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative h-24 w-24 shrink-0">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={displayName}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                  {initial}
                </div>
              )}
              <Button
                type="button"
                size="icon"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileImageChange}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CircleUserRound className="h-5 w-5 text-primary" />
                <h2 className="truncate text-2xl font-bold text-foreground">{displayName}</h2>
              </div>
              <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Email</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user?.email ?? "No email available"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="agent-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Edit Profile</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background px-4 py-4 sm:col-span-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">Display Name</p>
              <Input
                value={displayNameInput}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                placeholder="Enter your name"
                className="mt-3 h-11 rounded-lg"
              />
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4 sm:col-span-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">Profile Image</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload Image
                </Button>
                {profileImageInput ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setProfileImageInput(null)}
                  >
                    Remove Image
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Session</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <p className="text-sm font-semibold text-foreground">
                  {accessToken && sessionToken ? "Authenticated" : "Limited"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button type="button" className="gap-2" disabled={isSaving} onClick={handleSaveProfile}>
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
            {saveMessage ? <p className="text-sm text-muted-foreground">{saveMessage}</p> : null}
          </div>
        </section>

        <aside className="agent-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Quick Activity</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-sm font-bold text-foreground">Agent workspace</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(profile?.stats.total_agents ?? 0) > 0
                  ? `${profile?.stats.total_agents ?? 0} agents created across your workspace.`
                  : "No agents created yet."}
              </p>
              <Link href="/agents">
                <Button variant="outline" size="sm" className="mt-3">
                  Manage Agents
                </Button>
              </Link>
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-sm font-bold text-foreground">Chat access</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open an agent to start or continue a conversation.
              </p>
              <Link href="/agents">
                <Button variant="outline" size="sm" className="mt-3">
                  Open Agents
                </Button>
              </Link>
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-sm font-bold text-foreground">Latest Agent</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {latestAgent?.name ?? "No agents created"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Created {formatDate(latestAgent?.created_at)}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <p className="text-sm font-bold text-foreground">Latest Conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {latestConversation?.agent_name ?? "No conversations yet"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {latestConversation
                  ? `${latestConversation.message_count} messages`
                  : "Start a chat to see activity"}
              </p>
            </div>
          </div>
        </aside>
      </div>
      <section className="agent-card mt-6 p-6">
        <div className="mb-5 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Security Settings</h2>
            <p className="text-sm text-muted-foreground">Change your password or sign out all devices.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleChangePassword} className="space-y-4 rounded-lg border border-border bg-background p-4">
            <p className="font-semibold text-foreground">Change Password</p>
            <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" required minLength={1} />
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" required minLength={6} />
            <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" required minLength={6} />
            <Button type="submit" disabled={isChangingPassword || !accessToken}>
              {isChangingPassword ? "Changing..." : "Change Password"}
            </Button>
          </form>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-semibold text-foreground">Sign out other devices</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This invalidates every active session, including this device. You may need to sign in again.
            </p>
            <Button type="button" variant="outline" className="mt-4" onClick={handleSignOutDevices} disabled={isSigningOutDevices || !accessToken}>
              {isSigningOutDevices ? "Signing out..." : "Sign Out All Devices"}
            </Button>
          </div>
        </div>
        {securityMessage ? <p className="mt-4 text-sm text-muted-foreground">{securityMessage}</p> : null}
      </section>
    </div>
  );
}
