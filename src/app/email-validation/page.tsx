"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Bot } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AUTHENTICATED_HOME } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function EmailValidationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, verifyForgotPassword } = useAuth();
  const email = searchParams.get("email") ?? "";
  const mode = searchParams.get("mode") ?? "signup";
  const devCode = searchParams.get("code") ?? "";
  const [code, setCode] = useState(devCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Missing email address");
      return;
    }
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit validation code");
      return;
    }

    setLoading(true);
    try {
      if (mode === "forgot") {
        await verifyForgotPassword(email, code.trim());
      } else {
        await verifyEmail(email, code.trim());
      }
      router.replace(AUTHENTICATED_HOME);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="auth-card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Validate your email</h1>
          <p className="mt-1 text-sm text-muted-foreground">{email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          <div>
            <Label htmlFor="code">Validation code</Label>
            <Input
              id="code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="mt-1 text-center tracking-[0.4em]"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function EmailValidationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <EmailValidationForm />
    </Suspense>
  );
}
