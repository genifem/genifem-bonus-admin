import { type NextRequest, NextResponse } from "next/server";

import { parseHost } from "@/lib/host";
import { clearSessionCookies, jarFor } from "@/lib/session";

/** Drop the session cookies without calling the API: the sign-out button's fallback when the
 *  API cannot be reached to revoke the refresh token, so the browser is signed out either way.
 *  The host says which session (an owner's, or the back office's). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 204 });
  const jar = jarFor(parseHost(request.headers.get("host")));
  if (jar) clearSessionCookies(response, jar);
  return response;
}
