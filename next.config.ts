import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const dev = process.env.NODE_ENV !== "production";

/**
 * What the owner's browser is allowed to load. Next.js inlines its own hydration scripts, so
 * script-src cannot be pinned to a nonce without more machinery than this is worth; the value
 * here is the rest of it: the page cannot be framed, a form cannot post anywhere but back to
 * us, and the page talks to nothing but this origin. Every API call goes through the BFF at
 * /api/*, and Nunito is self-hosted by next/font, so there is no third party to allow.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "frame-src 'none'",
  // The dev server pushes updates over a websocket.
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  // The browser tests build into their own directory. Without this, running them while a dev
  // server is up overwrites the .next it is serving from and kills it mid-session.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@crewstars/api-client", "@crewstars/i18n", "@crewstars/shared"],
  poweredByHeader: false,
  async headers() {
    // Vercel adds HSTS in front of this; these are the headers that belong to the app itself.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No page here needs a camera, a microphone or a location.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
