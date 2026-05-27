import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import AdminAuditPage from "../audit/page";
import CompliancePage from "../compliance/page";

export const dynamic = "force-dynamic";

export default async function AuditCompliancePage() {
  const audit = await AdminAuditPage();
  const compliance = await CompliancePage();

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Audit &amp; Compliance</h1>
          <p className="admin-page-copy">
            Review activity, retention policies, subject access requests, and MFA.
          </p>
        </div>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>
        <TabsContent value="audit">{audit}</TabsContent>
        <TabsContent value="compliance">{compliance}</TabsContent>
      </Tabs>
    </div>
  );
}
