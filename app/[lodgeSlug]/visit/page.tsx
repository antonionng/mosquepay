import PublicVisitPage, { metadata } from "@/app/visit/[slug]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function LodgeScopedVisitPage({
  params,
}: {
  params: Promise<{ lodgeSlug: string }>;
}) {
  const { lodgeSlug } = await params;
  return <PublicVisitPage params={Promise.resolve({ slug: lodgeSlug })} />;
}
