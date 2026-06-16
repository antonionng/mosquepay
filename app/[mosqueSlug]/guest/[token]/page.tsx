import GuestInvitationPage, { metadata } from "@/app/g/[token]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function MosqueScopedGuestInvitationPage({
  params,
}: {
  params: Promise<{ mosqueSlug: string; token: string }>;
}) {
  const { mosqueSlug, token } = await params;
  return (
    <GuestInvitationPage
      params={Promise.resolve({ token })}
      expectedMosqueSlug={mosqueSlug}
    />
  );
}
