import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("audit");
}

export default function AuditPage() {
  return <ComingSoonPage page="audit" />;
}
