import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("spin");
}

export default function SpinPage() {
  return <ComingSoonPage page="spin" />;
}
