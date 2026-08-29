import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Ruler } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Wachtwoord opnieuw instellen — NoXL" },
      {
        name: "description",
        content: "Stel een nieuw wachtwoord in voor je installateursaccount.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase plaatst de recovery-token in de URL-hash; de client pikt die
    // automatisch op en vuurt PASSWORD_RECOVERY.
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      setInvalid(true);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback: sessie kan al gehydrateerd zijn vóór de listener mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Wachtwoorden komen niet overeen");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Wachtwoord gewijzigd", {
        description: "Je bent nu ingelogd met je nieuwe wachtwoord.",
      });
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error("Mislukt", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">NoXL</h1>
            <p className="text-xs text-muted-foreground">Wachtwoord opnieuw instellen</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {invalid ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Deze resetlink is ongeldig of verlopen. Vraag een nieuwe link aan.
              </p>
              <Button asChild variant="outline">
                <Link to="/auth">Terug naar inloggen</Link>
              </Button>
            </div>
          ) : !ready ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="password">Nieuw wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="confirm">Bevestig wachtwoord</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bezig…
                  </>
                ) : (
                  "Wachtwoord instellen"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
