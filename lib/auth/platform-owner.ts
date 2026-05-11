const DEFAULT_PLATFORM_OWNER_EMAIL = "ag@experrt.com";

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function platformOwnerEmails() {
  const configured = process.env.PLATFORM_OWNER_EMAILS ?? DEFAULT_PLATFORM_OWNER_EMAIL;
  return configured
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

export function isPlatformOwnerEmail(email: string | null | undefined) {
  return platformOwnerEmails().includes(normalizeEmail(email));
}
