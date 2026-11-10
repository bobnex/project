import { createFileRoute } from "@tanstack/react-router";
import { CosmeticsShop } from "@/components/game/CosmeticsShop";

export const Route = createFileRoute("/_player/shop")({
  head: () => ({ meta: [
    { title: "Cosmetics Shop — Juvora" },
    { name: "description", content: "Collect Juvora avatar frames, badges and effects with coins, and customize your player look." },
    { property: "og:title", content: "Cosmetics Shop — Juvora" },
    { property: "og:description", content: "Collect cosmetics, top up Juvora coins and equip your signature player look." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CosmeticsShop,
});