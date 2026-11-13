import { createFileRoute, redirect } from "@tanstack/react-router";

// "/index" is not a real page — the welcome page lives at "/". Redirect once on the
// server/router level so the 404 screen never shows for this address.
export const Route = createFileRoute("/index")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true, statusCode: 301 });
  },
});
