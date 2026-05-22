import { redirect } from "next/navigation";
import { getCurrentAdminScope } from "@/lib/auth/permissions";

export async function requireOperatorPageAccess() {
  const scope = await getCurrentAdminScope();
  if (
    (scope.kind === "dummy" || scope.kind === "platform") &&
    (scope.role === "super_admin" || scope.role === "operator")
  ) {
    return scope;
  }

  redirect("/operator/login");
}
