import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidSupabaseUrl = /^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(supabaseUrl || "");
const isPlaceholderKey = /your|你的|publishable_key|project_url/i.test(supabaseAnonKey || "");

export const isSupabaseConfigured = Boolean(isValidSupabaseUrl && supabaseAnonKey && !isPlaceholderKey);
export const isSupabaseAuthEnabled = isSupabaseConfigured && import.meta.env.VITE_USE_SUPABASE_AUTH === "true";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;