import { createClient } from '@supabase/supabase-js';

/**
 * Admin client dùng SERVICE_ROLE key — bypass RLS.
 * Chỉ dùng ở server-side (API routes, Server Actions).
 * KHÔNG import vào client components.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
