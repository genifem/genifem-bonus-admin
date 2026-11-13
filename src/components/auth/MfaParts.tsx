"use client";

import { Copy, Download, KeyRound } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * The pieces of setting up an authenticator app (the owner's second factor, plan D8, and the
 * back office's, which every admin has, P7): the key as a QR code to scan, the key as text to
 * type, and the recovery codes shown once afterwards.
 */

/** "JBSW Y3DP EHPK 3PXP": a key read off a screen and typed into a phone. */
export const groupedKey = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;

/**
 * The `otpauth://` URI as a QR code, drawn in the browser (the `qrcode` package, as Geniverse
 * Learn's back office does): the key never goes to a third party. Until it is drawn, or if it
 * cannot be, nothing shows - the key below it can still be typed by hand.
 */
export function QrCode({ uri, label, size = 200 }: { uri: string; label: string; size?: number }) {
  const [image, setImage] = useState<{ uri: string; data: string } | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(uri, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then((data) => {
        if (live) setImage({ uri, data });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [uri, size]);

  const current = image?.uri === uri ? image.data : null;
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-border bg-white p-2"
      style={{ width: size + 18, height: size + 18 }}
    >
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element -- drawn in the browser as a data URL
        <img src={current} alt={label} width={size} height={size} className="block" />
      ) : null}
    </div>
  );
}

/** The key as text, with a button that copies it. */
export function SecretKey({ secret, copyLabel, copied }: { secret: string; copyLabel: string; copied: string }) {
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code
        translate="no"
        className="rounded-compact bg-surface px-3 py-2 font-mono text-sm font-bold tracking-wider break-all"
      >
        {groupedKey(secret)}
      </code>
      <Button
        type="button"
        variant="secondary"
        size="console"
        icon={<Copy aria-hidden="true" className="size-4" strokeWidth={2} />}
        onClick={() => void copyText(secret).then((ok) => ok && toast.show(copied))}
      >
        {copyLabel}
      </Button>
    </div>
  );
}

/** A link that opens the authenticator app with the key filled in, for someone on the phone
 *  that has it. */
export function OpenInApp({ uri, children }: { uri: string; children: React.ReactNode }) {
  return (
    <a
      href={uri}
      className="inline-flex min-h-11 items-center gap-2 font-extrabold text-brand-ink underline underline-offset-2"
    >
      <KeyRound aria-hidden="true" className="size-4" strokeWidth={2} />
      {children}
    </a>
  );
}

/**
 * The recovery codes, shown once: in a grid, with Copy and Download (a text file with a line
 * of explanation), so there is more than one way to keep them.
 */
export function RecoveryCodes({
  codes,
  labels,
}: {
  codes: readonly string[];
  labels: {
    copy: string;
    download: string;
    copied: string;
    /** The file's name and its first line. */
    fileName: string;
    fileHeading: string;
  };
}) {
  const toast = useToast();

  function download() {
    const text = `${labels.fileHeading}\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = labels.fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <ul
        translate="no"
        className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-3 font-mono text-sm font-bold tracking-wider"
      >
        {codes.map((code) => (
          <li key={code} className="text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="secondary"
          size="console"
          icon={<Copy aria-hidden="true" className="size-4" strokeWidth={2} />}
          onClick={() => void copyText(codes.join("\n")).then((ok) => ok && toast.show(labels.copied))}
        >
          {labels.copy}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="console"
          icon={<Download aria-hidden="true" className="size-4" strokeWidth={2} />}
          onClick={download}
        >
          {labels.download}
        </Button>
      </div>
    </>
  );
}

/** Copies text, quietly doing nothing where the clipboard is off: the text is on screen to
 *  copy by hand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
