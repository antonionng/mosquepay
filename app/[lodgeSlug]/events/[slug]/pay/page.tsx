import StandalonePayPage from "@/app/(public)/events/[slug]/pay/page";

export default async function LodgeScopedStandalonePayPage({
  params,
}: {
  params: Promise<{ lodgeSlug: string; slug: string }>;
}) {
  const { lodgeSlug, slug } = await params;
  return (
    <StandalonePayPage
      params={Promise.resolve({ slug })}
      searchParams={Promise.resolve({ lodge: lodgeSlug })}
    />
  );
}
