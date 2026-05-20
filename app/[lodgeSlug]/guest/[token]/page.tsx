import GuestInvitationPage, {
  dynamic,
  metadata,
} from "@/app/g/[token]/page";

export { dynamic, metadata };

export default async function LodgeScopedGuestInvitationPage({
  params,
}: {
  params: Promise<{ lodgeSlug: string; token: string }>;
}) {
  const { lodgeSlug, token } = await params;
  return (
    <GuestInvitationPage
      params={Promise.resolve({ token })}
      expectedLodgeSlug={lodgeSlug}
    />
  );
}
