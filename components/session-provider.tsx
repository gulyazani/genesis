"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiGet } from "@/lib/api-client";
import type { Session } from "@/lib/types";

type SessionContextValue = {
  session: Session | null;
  initData: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session;
}) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [initData, setInitData] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      tg?.setHeaderColor?.("#07070b");
      tg?.setBackgroundColor?.("#07070b");
      const data = tg?.initData ?? "";
      setInitData(data);
      const next = await apiGet<Session>("/api/me", data);
      setSession(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Oturum alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(
    () => ({ session, initData, loading, error, refresh }),
    [session, initData, loading, error],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession SessionProvider içinde kullanılmalı.");
  }
  return ctx;
}
