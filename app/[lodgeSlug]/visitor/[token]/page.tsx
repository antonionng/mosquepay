import VisitorPortalPage, {
  dynamic,
  metadata,
} from "@/app/visitor/[token]/page";

export { dynamic, metadata };

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
