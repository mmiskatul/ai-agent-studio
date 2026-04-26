"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string | null;
  profile_image?: string | null;
}

interface AuthSession {
  user: AuthUser;
  accessToken: string;
  sessionToken: string;
}

interface EmailValidationResponse {
  email: string;
  message: string;
}

interface MessageResponse {
  message: string;
}

interface TokenResponse {
  access_token: string;
  session_token: string;
  user: AuthUser;
}

const AUTH_STORAGE_KEY = "agenthub.auth.session";

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`/backend/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Request failed");
  }

  return body as T;
}

function readStoredSession() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function writeStoredSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;

  if (session) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function clearStoredSession() {
  writeStoredSession(null);
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readStoredSession();
    setUser(session?.user ?? null);
    setAccessToken(session?.accessToken ?? null);
    setSessionToken(session?.sessionToken ?? null);
    setLoading(false);
  }, []);

  const storeTokenResponse = useCallback((response: TokenResponse) => {
    const session = {
      user: response.user,
      accessToken: response.access_token,
      sessionToken: response.session_token,
    };
    writeStoredSession(session);
    setUser(session.user);
    setAccessToken(session.accessToken);
    setSessionToken(session.sessionToken);
    return session.user;
  }, []);

  const clearSessionState = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setAccessToken(null);
    setSessionToken(null);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await requestJson<TokenResponse>("/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      return storeTokenResponse(response);
    },
    [storeTokenResponse],
  );

  const signUp = useCallback(async (email: string, password: string) => {
    return requestJson<EmailValidationResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }, []);

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const response = await requestJson<TokenResponse>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      return storeTokenResponse(response);
    },
    [storeTokenResponse],
  );

  const forgotPassword = useCallback(async (email: string) => {
    return requestJson<EmailValidationResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }, []);

  const verifyForgotPassword = useCallback(async (email: string, code: string) => {
    return requestJson<MessageResponse>("/auth/forgot-password/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  }, []);

  const resetForgotPassword = useCallback(async (email: string, code: string, password: string) => {
    return requestJson<MessageResponse>("/auth/forgot-password/reset", {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
    });
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!sessionToken) return null;
    try {
      const response = await requestJson<{ access_token: string }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ session_token: sessionToken }),
      });
      const existingSession = readStoredSession();
      if (!existingSession) {
        clearSessionState();
        return null;
      }
      const nextSession = { ...existingSession, accessToken: response.access_token };
      writeStoredSession(nextSession);
      setAccessToken(response.access_token);
      return response.access_token;
    } catch {
      clearSessionState();
      return null;
    }
  }, [clearSessionState, sessionToken]);

  const signOut = useCallback(async () => {
    clearSessionState();
  }, [clearSessionState]);

  return {
    user,
    accessToken,
    sessionToken,
    loading,
    signIn,
    signUp,
    verifyEmail,
    forgotPassword,
    verifyForgotPassword,
    resetForgotPassword,
    refreshAccessToken,
    signOut,
  };
}
