import { createBrowserClient } from "@supabase/ssr";

export function createClient(customToken?: string) {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // If a custom token (WorkOS JWT) is provided, set it in the session
  if (customToken) {
    client.realtime.setAuth(customToken);
    
    // We overwrite the global fetch to always inject the JWT token if necessary,
    // though passing it in the Authorization header to standard fetch is often better.
    // We'll manage standard authenticated requests with `client.auth.setSession` if needed, 
    // but since we rely on external Auth (WorkOS), we mainly need this for RLS.
  }

  return client;
}
