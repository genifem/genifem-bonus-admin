import { Info } from "lucide-react";

/** The rule pages' note that changes save as they are typed and apply in the app at once (the
 *  prototype's LiveNote). Not a client component: the page passes the words. */
export function LiveNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-lg bg-info-subtle p-3 text-sm">
      <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-info-ink" strokeWidth={2.2} />
      <span>{children}</span>
    </p>
  );
}
