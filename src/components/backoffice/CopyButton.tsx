"use client";

import { Copy } from "lucide-react";

import { copyText } from "@/components/auth/MfaParts";
import { Button, useToast } from "@/components/ui";

/** Copies a value (an operator's portal address) and says so in a toast. */
export function CopyButton({ text, label, copied }: { text: string; label: string; copied: string }) {
  const toast = useToast();
  return (
    <Button
      type="button"
      variant="secondary"
      size="xs"
      icon={<Copy aria-hidden="true" className="size-4" strokeWidth={2} />}
      onClick={() => void copyText(text).then((ok) => ok && toast.show(copied))}
    >
      {label}
    </Button>
  );
}
