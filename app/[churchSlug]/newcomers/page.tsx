import PublicVisitPage, { metadata } from "@/app/newcomers/church/[slug]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function ChurchScopedVisitPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  return <PublicVisitPage params={Promise.resolve({ slug: churchSlug })} />;
}
