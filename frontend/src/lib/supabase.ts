import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
const key = typeof rawKey === "string" ? rawKey.trim() : "";
const hasEnv =
  url.length > 0 &&
  key.length > 0 &&
  url.startsWith("https://") &&
  url.includes("supabase.co") &&
  !url.includes("placeholder");

export const isSupabaseConfigured = hasEnv;

function getStubClient(): SupabaseClient {
  const err = { message: "Supabase not configured" };
  const noop = () => Promise.resolve({ data: null, error: err });
  const noopUser = () => Promise.resolve({ data: { user: null }, error: err });
  const result = Promise.resolve({ data: null, error: err });
  const chain = (): Promise<{ data: null; error: { message: string } }> & Record<string, () => unknown> => {
    const p = result as Promise<{ data: null; error: { message: string } }> & Record<string, () => unknown>;
    p.eq = () => chain();
    p.select = () => chain();
    p.insert = () => chain();
    p.upsert = () => chain();
    p.delete = () => chain();
    p.single = () => chain();
    return p;
  };
  return {
    auth: {
      getUser: noopUser,
      signInWithPassword: noop,
      signUp: noop,
      signOut: () => Promise.resolve({ error: null }),
      updateUser: noop,
      getSession: noopUser,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => chain(),
    channel: () => ({ on: () => ({ subscribe: () => {} }), unsubscribe: () => {} }),
    removeChannel: () => {},
  } as unknown as SupabaseClient;
}

function createSupabaseClient(): SupabaseClient {
  if (!hasEnv) return getStubClient();
  try {
    return createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    return getStubClient();
  }
}

export const supabase = createSupabaseClient();
