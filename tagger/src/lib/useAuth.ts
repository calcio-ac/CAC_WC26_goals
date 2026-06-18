import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Only these emails may log in and write. Mirror of public.is_tagger() in SQL. */
export const ALLOWED_TAGGERS = ["pp33@cac.com", "av@cac.com"];

export interface Auth {
  session: Session | null;
  email: string | null;
  allowed: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const email = session?.user?.email ?? null;
  const allowed = !!email && ALLOWED_TAGGERS.includes(email.toLowerCase());

  const signIn = useCallback(async (em: string, pw: string) => {
    if (!supabase) throw new Error("Supabase is not configured (.env missing)");
    const { error } = await supabase.auth.signInWithPassword({
      email: em.trim().toLowerCase(),
      password: pw,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return { session, email, allowed, loading, signIn, signOut };
}
