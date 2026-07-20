import { createBrowserClient } from "@supabase/ssr";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getPublicKey());
}

function getPublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getPublicKey();
  if (!url || !key) throw new Error("Supabase 尚未配置，当前应使用演示数据模式。");
  return createBrowserClient(url, key);
}

export async function ensureAnonymousSession() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signedIn.session;
}
