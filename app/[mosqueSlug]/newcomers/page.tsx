import PublicVisitPage, { metadata } from "@/app/newcomers/mosque/[slug]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function MosqueScopedVisitPage({
  params,
}: {
  params: Promise<{ mosqueSlug: string }>;
}) {
  const { mosqueSlug } = await params;
  return <PublicVisitPage params={Promise.resolve({ slug: mosqueSlug })} />;
}
