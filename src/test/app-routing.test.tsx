import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { NAV } from "@/components/game/AppShell";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("keeps the course directory out of the main navigation", () => {
    expect(NAV.map((n) => n.to)).not.toContain("/courses");
  });

  it("puts the help page in the bottom navigation", () => {
    const help = NAV.find((n) => n.to === "/help");
    expect(help?.label).toBe("Help");

    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/help");
    expect(matches.at(-1)?.routeId).toBe("/_player/help");
  });
});
