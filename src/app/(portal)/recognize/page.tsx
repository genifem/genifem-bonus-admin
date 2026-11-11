import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";

export function generateMetadata() {
  return portalMetadata("recognize");
}

export default function RecognizePage() {
  return <ComingSoonPage page="recognize" />;
}
