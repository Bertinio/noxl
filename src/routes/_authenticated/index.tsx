import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getMyRole } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/")({
  component: RoleRedirect,
});

function RoleRedirect() {
  const navigate = useNavigate();
  const fetchRole = useServerFn(getMyRole);
  const { data, isLoading } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
  });

  useEffect(() => {
    if (!data) return;
    navigate({ to: data.role === "customer" ? "/portal" : "/dashboard", replace: true });
  }, [data, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      {isLoading ? null : null}
    </div>
  );
}
