import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("roster");
}

export default function RosterPage() {
  return <ComingSoonPage page="roster" />;
}
