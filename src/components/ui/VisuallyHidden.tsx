/** Text for a screen reader that the page does not draw. Not `display: none`, which would
 *  hide it from assistive technology too. */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
