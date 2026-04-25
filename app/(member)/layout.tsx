import { MemberLayoutWrapper } from "@/components/layout/member-layout-wrapper";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MemberLayoutWrapper>{children}</MemberLayoutWrapper>;
}
