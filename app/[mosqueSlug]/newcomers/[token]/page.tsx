import NewcomerPortalPage, { metadata } from "@/app/newcomers/link/[token]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function MosqueScopedNewcomerPortalPage({
  params,
}: {
  params: Promise<{ mosqueSlug: string; token: string }>;
}) {
  const { mosqueSlug, token } = await params;
  return (
    <NewcomerPortalPage
      params={Promise.resolve({ token })}
      expectedMosqueSlug={mosqueSlug}
    />
  );
}
