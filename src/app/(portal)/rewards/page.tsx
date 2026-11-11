import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("rewards");
}

export default function RewardsPage() {
  return <ComingSoonPage page="rewards" />;
}
