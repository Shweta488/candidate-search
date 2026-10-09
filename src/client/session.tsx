"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { browserSupabase } from "./supabase";

// Who is signed in (LLD 6.2). supabase-js keeps the session in localStorage and refreshes the token.

type Status = "loading" | "signed-in" | "signed-out";
type SessionValue = { session: Session | null; status: Status; signOut: () => Promise<void> };

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const supabase = browserSupabase();
    const apply = (next: Session | null) => {
      setSession(next);
      setStatus(next ? "signed-in" : "signed-out");
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => apply(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await browserSupabase().auth.signOut();
  }, []);

  const value = useMemo(() => ({ session, status, signOut }), [session, status, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
