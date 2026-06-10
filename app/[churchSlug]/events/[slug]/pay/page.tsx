import StandalonePayPage from "@/app/(public)/events/[slug]/pay/page";

export default async function ChurchScopedStandalonePayPage({
  params,
}: {
  params: Promise<{ churchSlug: string; slug: string }>;
}) {
  const { churchSlug, slug } = await params;
  return (
    <StandalonePayPage
      params={Promise.resolve({ slug })}
      searchParams={Promise.resolve({ church: churchSlug })}
    />
  );
}
