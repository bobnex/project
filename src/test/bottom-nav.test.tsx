import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// AppShell only needs Link/useLocation from the router, and a signed-in player from
// the app context, so both are stubbed here to render the shell on its own.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: "/home" }),
}));

vi.mock("@/lib/app-context", () => ({
  useApp: () => ({
    profile: { username: "ada", level: 3, rating: 1200, coins: 40, status: "active", paymentStatus: "verified" },
    isAdmin: false,
    fb: null,
    user: null,
  }),
}));

vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  onSnapshot: () => () => {},
}));

vi.mock("@/lib/engine", () => ({ settlePending: async () => {} }));

import { AppShell } from "@/components/game/AppShell";

describe("the bottom bar", () => {
  it("offers the help page", () => {
    render(
      <AppShell>
        <p>page body</p>
      </AppShell>,
    );

    const bar = screen.getAllByRole("navigation", { hidden: true }).at(-1)!;
    const help = Array.from(bar.querySelectorAll("a")).find((a) => a.getAttribute("href") === "/help");

    expect(help).toBeTruthy();
    expect(help!.textContent).toContain("Help");
  });
});
