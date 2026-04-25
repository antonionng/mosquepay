import { OperatorLayoutWrapper } from "@/components/layout/operator-layout-wrapper";

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OperatorLayoutWrapper>{children}</OperatorLayoutWrapper>;
}
