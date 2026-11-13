"use client";

import { useEffect } from "react";

import { apiGet, apiPost } from "@/lib/api";
import { IDLE_SIGN_IN } from "@/lib/session-paths";

/** The API's idle window (CS_PLATFORM_IDLE_MINUTES, 20 by default): this page leaves after the
 *  same time without anyone using it. */
const IDLE_MS = 20 * 60 * 1000;
/** How long someone can work on one page (typing a reason, reading the audit log) before the
 *  page tells the API they are still here. */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

/**
 * The back office's idle sign-out, in the browser (P7). The API ends a back office session
 * after 20 minutes without a request (401 session_idle); the next call then sends the admin to
 * sign in, and the sign-in page says why (lib/api.ts, /api/session/refresh). Two things are
 * left for the page itself:
 *
 * - A page left open must not keep showing every operator's data once the session is over. So
 *   after the same 20 minutes without a key, a tap or a click, it signs out and goes to the
 *   sign-in page. A laptop that slept is checked when it wakes and the tab is seen again.
 * - Someone at work on one page - reading, typing a long reason - makes no requests, and the
 *   API would count them as idle. So while they are using the page, it asks GET /platform/me
 *   every few minutes, which tells the API they are here (and, if the session is already over,
 *   sends them to sign in at once rather than when they press Save).
 *
 * Renders nothing.
 */
export function IdleSignOut() {
  useEffect(() => {
    let lastUse = Date.now();
    let lastTouch = Date.now();
    let leaving = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function signOut() {
      if (leaving) return;
      leaving = true;
      await apiPost("/auth/platform/logout").catch(() => undefined);
      await fetch("/api/session/end", { method: "POST" }).catch(() => undefined);
      window.location.assign(IDLE_SIGN_IN);
    }

    function check() {
      const idle = Date.now() - lastUse;
      if (idle >= IDLE_MS) {
        void signOut();
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(check, IDLE_MS - idle);
    }

    function used() {
      lastUse = Date.now();
      if (lastUse - lastTouch >= TOUCH_EVERY_MS) {
        lastTouch = lastUse;
        // A 401 here (the session went idle on the API) sends them to sign in (lib/api.ts).
        void apiGet("/platform/me").catch(() => undefined);
      }
    }

    function seen() {
      if (document.visibilityState === "visible") check();
    }

    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) window.addEventListener(name, used, { passive: true });
    document.addEventListener("visibilitychange", seen);
    timer = setTimeout(check, IDLE_MS);
    return () => {
      clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, used);
      document.removeEventListener("visibilitychange", seen);
    };
  }, []);
  return null;
}
