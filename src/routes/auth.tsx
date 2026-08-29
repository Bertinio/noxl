import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Ruler } from "lucide-react";

import {
  getSession,
  requestPasswordReset,
  signInWithEmail,
  signOutEverywhere,
} from "@/lib/auth-client";
import { getMyAccountStatus } from "@/lib/noxl.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Inloggen — NoXL" },
      {
        name: "description",
        content:
          "Log in op NoXL. Nieuwe installateursaccounts worden aangemaakt door een beheerder.",
      },
      { property: "og:title", content: "Inloggen — NoXL" },
      {
        property: "og:description",
        content: "NoXL: offerte- en configuratietool voor installateurs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getMyAccountStatus);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    getSession().then((session) => {
      if (session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await requestPasswordReset(
      email,
      `${window.location.origin}/reset-password`,
    );
    setBusy(false);
    if (!res.ok) {
      toast.error("Mislukt", { description: res.message });
      return;
    }
    setResetSent(true);
    toast.success("Resetlink verstuurd", {
      description: "Controleer je e-mail om je wachtwoord opnieuw in te stellen.",
    });
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await signInWithEmail(email, password);
      if (!res.ok) throw new Error(res.message);

      // Gedeactiveerde accounts mogen niet doorgaan naar de app.
      const status = await fetchStatus();
      if (!status.active) {
        await signOutEverywhere();
        throw new Error(
          "Dit account is gedeactiveerd. Neem contact op met je beheerder.",
        );
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error("Inloggen mislukt", {
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
            <p className="text-xs text-muted-foreground">Inloggen voor installateurs en beheerders</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {mode === "forgot" ? (
            <form onSubmit={handleForgot} className="grid gap-3">
              <h2 className="text-base font-semibold text-foreground">Wachtwoord vergeten</h2>
              <p className="text-sm text-muted-foreground">
                Vul je e-mailadres in. Je ontvangt een link om je wachtwoord opnieuw in te stellen.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="reset-email">E-mailadres</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" disabled={busy || resetSent}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bezig…
                  </>
                ) : resetSent ? (
                  "Resetlink verstuurd"
                ) : (
                  "Verstuur resetlink"
                )}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setResetSent(false);
                }}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Terug naar inloggen
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="grid gap-3">
              <h2 className="text-base font-semibold text-foreground">Inloggen</h2>
              <div className="grid gap-1.5">
                <Label htmlFor="email">E-mailadres</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bezig…
                  </>
                ) : (
                  "Inloggen"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="justify-self-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Wachtwoord vergeten?
              </button>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Nieuwe accounts worden aangemaakt door een beheerder via Beheer → Installateurs.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
