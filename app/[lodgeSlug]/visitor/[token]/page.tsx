import VisitorPortalPage, { metadata } from "@/app/visitor/[token]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function LodgeScopedVisitorPortalPage({
  params,
}: {
  params: Promise<{ lodgeSlug: string; token: string }>;
}) {
  const { lodgeSlug, token } = await params;
  return (
    <VisitorPortalPage
      params={Promise.resolve({ token })}
      expectedLodgeSlug={lodgeSlug}
    />
  );
}
