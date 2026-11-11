import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-12">
      <h1 className="text-3xl font-black">{t("notFound.title")}</h1>
      <p className="text-muted">{t("notFound.lead")}</p>
      <Link href="/" className="font-extrabold text-brand-ink underline underline-offset-2">
        {t("common.backHome")}
      </Link>
    </main>
  );
}
