"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button, ErrorState } from "@/components/ui";

/**
 * A back office page that could not be drawn - most often the API out of reach. Says so in
 * words with one way on; Try again fetches and renders the page again. Covers the console's
 * layout too (asking who is signed in), so it stands on its own rather than inside the rail.
 */
export default function PlatformError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("platform.error");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-12">
      <ErrorState
        title={t("title")}
        lead={t("lead")}
        action={
          <Button variant="secondary" size="console" onClick={() => retry()}>
            {t("retry")}
          </Button>
        }
      />
    </main>
  );
}
