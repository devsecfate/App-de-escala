import { createSupabaseClient } from "@escala-app/core";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em apps/web/.env (veja apps/web/.env.example).",
  );
}

export const supabase = createSupabaseClient(url, anonKey);
