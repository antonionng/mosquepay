import StandalonePayPage from "@/app/(public)/events/[slug]/pay/page";

export default async function MosqueScopedStandalonePayPage({
  params,
}: {
  params: Promise<{ mosqueSlug: string; slug: string }>;
}) {
  const { mosqueSlug, slug } = await params;
  return (
    <StandalonePayPage
      params={Promise.resolve({ slug })}
      searchParams={Promise.resolve({ mosque: mosqueSlug })}
    />
  );
}
