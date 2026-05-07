import { redirect } from "next/navigation";

export default async function AdminSigninPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const target = from ? `/admin/login?from=${encodeURIComponent(from)}` : "/admin/login";

  redirect(target);
}
