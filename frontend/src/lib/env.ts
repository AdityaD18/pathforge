// Public configuration only. These values ship to the browser by design:
// the anon/publishable key is safe to expose because row-level security governs access.
// Privileged credentials live exclusively in the FastAPI backend.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, ""),
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
