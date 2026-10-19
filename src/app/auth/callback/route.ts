import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Only same-site relative paths, so the link can't bounce users elsewhere. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

/**
 * Lands magic-link clicks. Supports both link styles Supabase can send:
 *  - `?code=` (PKCE; default email template; same browser only)
 *  - `?token_hash=&type=` (custom template in this repo; works in any browser)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  const fail = (reason: string) => {
    const url = new URL("/sign-in", origin);
    url.searchParams.set("error", reason);
    return NextResponse.redirect(url);
  };

  const providerError = searchParams.get("error_code") ?? searchParams.get("error");
  if (providerError) return fail(providerError);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.code === "flow_state_not_found" || /verifier/i.test(error.message) ? "pkce" : (error.code ?? "unknown"));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.code ?? "otp_expired");
  } else {
    return fail("missing_code");
  }

  // "/" works out where the user belongs (onboarding, calendar, ...).
  return NextResponse.redirect(new URL(next, origin));
}
