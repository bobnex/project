// Shared allowlist for browser navigation and server-side authorization.
export const ADMIN_EMAILS = [
  "danilo@gmail.com", "daniloofuje@gmail.com", "favojee@gmail.com", "favoje@gmail.com",
  "favoje.dev@gmail.com", "admin@favoje.com", "support@favoje.com", "balogunofuje@gmail.com",
  "kingbobbynet@gmail.com", "ofuje0353@gmail.com", "ofuje0353-spec@gmail.com",
  "favojee@outlook.com", "favojee.dev@outlook.com", "ofuje@favoje.com", "bobby@favoje.com",
  "ofuje0353-spec@outlook.com", "ofuje0353-spec@yahoo.com",
];

export function isAdminEmail(email: string | null | undefined, _name?: string | null): boolean {
  return ADMIN_EMAILS.includes(email?.trim().toLowerCase() ?? "");
}