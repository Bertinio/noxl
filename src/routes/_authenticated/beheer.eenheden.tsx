import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { UnitsManager } from "@/components/noxl/UnitsManager";
import { Toaster } from "@/components/ui/sonner";
import { getMyRole } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/beheer/eenheden")({
  head: () => ({
    meta: [
      { title: "Eenheden — NoXL" },
      { name: "description", content: "Beheer de eenheden en rekentypes die installateurs gebruiken in producten en offertes." },
      { property: "og:title", content: "Eenheden — NoXL" },
      { property: "og:description", content: "Beheer de eenheden en rekentypes die installateurs gebruiken in producten en offertes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnitsAdminPage,
});

function UnitsAdminPage() {
  const fetchRole = useServerFn(getMyRole);
  const role = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });

  if (role.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (role.data?.role !== "admin") {
    return (
      <AppShell title="Eenheden">
        <p className="text-sm text-muted-foreground">
          Geen toegang. Eenheden beheren is voorbehouden aan beheerders.{" "}
          <Link to="/instellingen" className="underline">
            Eigen eenheden beheer je in Instellingen
          </Link>
          .
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Eenheden">
      <Toaster position="top-right" richColors />
      <p className="mb-4 text-sm text-muted-foreground">
        Globale eenheden zijn beschikbaar voor alle installateurs. Het rekentype bepaalt welke velden de
        configurator vraagt en hoe de prijs wordt berekend.
      </p>
      <UnitsManager scope="global" />
    </AppShell>
  );
}
