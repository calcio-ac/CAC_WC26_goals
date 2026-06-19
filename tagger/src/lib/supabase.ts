import { createClient, SupabaseClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

// Accept either the base project URL or the REST endpoint — supabase-js needs
// the BASE url (it appends /auth/v1, /rest/v1 itself). Strip a trailing
// "/rest/v1" and any trailing slashes so both forms work.
const url = rawUrl?.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");

/** Configured only when both env vars are present. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const supabaseConfigured = !!supabase;
