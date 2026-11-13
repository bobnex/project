import { createFileRoute, redirect } from "@tanstack/react-router";

// Common short address — send visitors straight to the real page instead of a 404.
export const Route = createFileRoute("/tournament")({
  beforeLoad: () => {
    throw redirect({ to: "/tournaments", replace: true, statusCode: 301 });
  },
});
