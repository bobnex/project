export function pageMeta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Favoje Battle` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Favoje Battle` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
