import { createClient } from "@supabase/supabase-js";

let supabaseInstance;

export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!isValidHttpUrl(url) || !anonKey || anonKey === "your_supabase_anon_key") {
    return null;
  }

  supabaseInstance = createClient(url, anonKey);
  return supabaseInstance;
}

function isValidHttpUrl(value) {
  if (!value || value === "your_supabase_project_url") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
