import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("awards");
}

export default function AwardsPage() {
  return <ComingSoonPage page="awards" />;
}
