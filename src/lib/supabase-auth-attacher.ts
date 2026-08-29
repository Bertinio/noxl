import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

// Project-specific replacement for the generated `attachSupabaseAuth`.
// The generated version reads getSession() once; right after page load (or while
// a token refresh is in flight) that can still be null, so protected serverFn
// calls fire without an Authorization header and fail with
// "Unauthorized: No authorization header provided".
// This version waits briefly for the session to hydrate before giving up.
async function getAccessToken(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return token;
    if (attempt === 0) {
      // Try to restore/refresh a persisted session once.
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session?.access_token) return refreshed.session.access_token;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return undefined;
}

export const attachSupabaseAuthToken = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await getAccessToken();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
