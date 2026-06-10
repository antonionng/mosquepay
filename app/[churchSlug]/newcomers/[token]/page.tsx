import NewcomerPortalPage, { metadata } from "@/app/newcomers/link/[token]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function ChurchScopedNewcomerPortalPage({
  params,
}: {
  params: Promise<{ churchSlug: string; token: string }>;
}) {
  const { churchSlug, token } = await params;
  return (
    <NewcomerPortalPage
      params={Promise.resolve({ token })}
      expectedChurchSlug={churchSlug}
    />
  );
}
