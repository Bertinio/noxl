// Enige plaats in de client waar de Lovable/Supabase auth-wrapper wordt
// aangesproken. UI-componenten mogen nooit direct `supabase.auth.*` gebruiken;
// ze roepen uitsluitend deze functies (of server actions) aan.
import { supabase } from "@/integrations/supabase/client";
import type { QueryClient } from "@tanstack/react-query";

export type AuthResult = { ok: true } | { ok: false; message: string };

function fail(err: unknown): AuthResult {
  return { ok: false, message: err instanceof Error ? err.message : String(err) };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthEvent(
  handler: (event: string, hasSession: boolean) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    handler(event, Boolean(session));
  });
  return () => data.subscription.unsubscribe();
}

/** Inloggen met e-mail + wachtwoord (bestaande accounts). */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail(error);
  return { ok: true };
}

/** Volledige, veilige uitlog-flow inclusief cache-opruiming. */
export async function signOutEverywhere(queryClient?: QueryClient) {
  if (queryClient) {
    await queryClient.cancelQueries();
    queryClient.clear();
  }
  await supabase.auth.signOut();
}

/** Wachtwoord-vergeten: Supabase reset-link, geen eigen e-mailflow. */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return fail(error);
  return { ok: true };
}

/** Nieuw wachtwoord instellen vanuit een recovery-sessie. */
export async function setNewPassword(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error);
  return { ok: true };
}

/** Wachtwoord wijzigen als ingelogde gebruiker. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });
  if (error) return fail(error);
  return { ok: true };
}
