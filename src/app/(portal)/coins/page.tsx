import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("coins");
}

export default function CoinsPage() {
  return <ComingSoonPage page="coins" />;
}
