import GuestInvitationPage, { metadata } from "@/app/g/[token]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function ChurchScopedGuestInvitationPage({
  params,
}: {
  params: Promise<{ churchSlug: string; token: string }>;
}) {
  const { churchSlug, token } = await params;
  return (
    <GuestInvitationPage
      params={Promise.resolve({ token })}
      expectedChurchSlug={churchSlug}
    />
  );
}
