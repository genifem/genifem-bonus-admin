import { NextResponse } from "next/server";

import { clearSessionCookies } from "@/lib/session";

/** Drop the session cookies without calling the API: the sign-out button's fallback when the
 *  API cannot be reached to revoke the refresh token, so the browser is signed out either way. */
export async function POST(): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookies(response);
  return response;
}
