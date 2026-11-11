import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("people");
}

export default function PeoplePage() {
  return <ComingSoonPage page="people" />;
}
