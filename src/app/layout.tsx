import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

import { ToastProvider } from "@/components/ui";

import "./globals.css";

// The prototype's one typeface, at the five weights it uses (plan §13, NF-03). Self-hosted by
// next/font, so the page reaches no font CDN.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: { default: "Crew Stars", template: "%s · Crew Stars" },
  description: "Owner portal for Crew Stars recognition",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFF8F1",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          {/* The live region has to exist from first render: announcing into a node added at
              the same moment is unreliable. */}
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
