import { createFileRoute, redirect } from "@tanstack/react-router";

// NoXL kent enkel admins en installateurs: iedereen komt op het dashboard.
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
