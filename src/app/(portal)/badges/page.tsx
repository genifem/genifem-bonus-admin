import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("badges");
}

export default function BadgesPage() {
  return <ComingSoonPage page="badges" />;
}
