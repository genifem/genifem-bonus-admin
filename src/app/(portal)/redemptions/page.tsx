import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("redemptions");
}

export default function RedemptionsPage() {
  return <ComingSoonPage page="redemptions" />;
}
