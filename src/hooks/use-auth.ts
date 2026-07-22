"use client";

import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { backendFetch } from "@/lib/backend-fetch";
import { getApiErrorMessage } from "@/lib/error-message";
import { clearAllSessionCache } from "@/lib/session-cache";

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
  const response = await backendFetch(`/backend/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, "Request failed"));
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

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  sessionToken: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (email: string, password: string) => Promise<EmailValidationResponse>;
  verifyEmail: (email: string, code: string) => Promise<AuthUser>;
  forgotPassword: (email: string) => Promise<EmailValidationResponse>;
  verifyForgotPassword: (email: string, code: string) => Promise<MessageResponse>;
  resetForgotPassword: (
    email: string,
    code: string,
    password: string,
  ) => Promise<MessageResponse>;
  refreshAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const storedSession = readStoredSession();
      if (!storedSession) {
        setLoading(false);
        return;
      }

      try {
        let nextSession = storedSession;
        try {
          await requestJson<AuthUser>("/auth/me", {
            headers: { Authorization: `Bearer ${storedSession.accessToken}` },
          });
        } catch {
          const refreshed = await requestJson<{ access_token: string }>("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ session_token: storedSession.sessionToken }),
          });
          nextSession = { ...storedSession, accessToken: refreshed.access_token };
        }

        if (cancelled) return;
        writeStoredSession(nextSession);
        setUser(nextSession.user);
        setAccessToken(nextSession.accessToken);
        setSessionToken(nextSession.sessionToken);
      } catch {
        if (cancelled) return;
        clearStoredSession();
        clearAllSessionCache();
        setUser(null);
        setAccessToken(null);
        setSessionToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void hydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const storeTokenResponse = useCallback((response: TokenResponse) => {
    const existingSession = readStoredSession();
    const isDifferentUser =
      existingSession?.user?.id && existingSession.user.id !== response.user.id;
    if (isDifferentUser) {
      clearAllSessionCache();
    }

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
    clearAllSessionCache();
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

  const value = useMemo<AuthContextValue>(
    () => ({
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
    }),
    [
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
    ],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
