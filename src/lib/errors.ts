/** Minimal shape of a PostgREST / Postgres error as returned by supabase-js. */
export type DbError = { code?: string; message?: string; hint?: string | null } | null | undefined;

const MESSAGES: Record<string, string> = {
  // Invitations & enrolment
  INVITATION_INVALID: "That invitation code isn't valid. Check it for typos, or ask for a new one.",
  INVITATION_REVOKED: "That invitation code has been revoked. Ask an administrator for a new one.",
  INVITATION_EXPIRED: "That invitation code has expired. Ask an administrator for a new one.",
  INVITATION_USED: "That invitation code has already been used. Ask an administrator for a new one.",
  INVITATION_EXPIRY_IN_PAST: "The expiry date must be in the future.",
  ALREADY_ENROLLED: "This account is already a member, so it doesn't need another invitation.",
  PROFILE_INVALID: "Please choose a display name (1–40 characters) and one of the avatars.",
  EMAIL_REQUIRED: "Your account has no email address. Sign in with your email and try again.",
  NOT_AUTHENTICATED: "Your session has expired. Please sign in again.",
  // Bookings
  BOOKING_IN_PAST: "That booking would already be over. Pick a time in the future.",
  BOOKING_ALREADY_ENDED: "This booking has already ended and can no longer be changed.",
  BOOKING_ALREADY_CANCELLED: "This booking was already cancelled.",
  BOOKING_OWNER_IMMUTABLE: "A booking can't be moved to another member.",
  // Admin
  CANNOT_CHANGE_SELF: "You can't change your own role or access. Ask another administrator.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "That item no longer exists. It may have been removed by someone else.",
};

export const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";

/** Code raised by our database functions/triggers, e.g. "BOOKING_IN_PAST". */
export function dbErrorCode(error: DbError): string | undefined {
  if (!error) return undefined;
  if (error.code === "23P01") return "BOOKING_CONFLICT";
  if (error.code === "42501") return "FORBIDDEN";
  const msg = error.message ?? "";
  if (/^[A-Z_]+$/.test(msg) && msg in MESSAGES) return msg;
  if (error.code === "23514") {
    if (msg.includes("bookings_min_length")) return "BOOKING_TOO_SHORT";
    if (msg.includes("bookings_max_length")) return "BOOKING_TOO_LONG";
    if (msg.includes("bookings_valid_range")) return "BOOKING_INVALID_RANGE";
    return "CHECK_FAILED";
  }
  return undefined;
}

export function friendlyDbError(error: DbError): string {
  const code = dbErrorCode(error);
  if (code && code in MESSAGES) return MESSAGES[code];
  switch (code) {
    case "BOOKING_CONFLICT":
      return "Someone else has booked the house for part of that time.";
    case "BOOKING_TOO_SHORT":
      return "A booking must last at least 15 minutes.";
    case "BOOKING_TOO_LONG":
      return "A single booking can last at most 62 days.";
    case "BOOKING_INVALID_RANGE":
      return "The end must be after the start.";
    case "CHECK_FAILED":
      return "Some of the details aren't valid. Please check the form.";
  }
  return GENERIC_ERROR;
}

/** Messages for auth errors surfaced from Supabase Auth or our callback. */
export function friendlyAuthError(code: string | null | undefined, message?: string): string {
  const m = (message ?? "").toLowerCase();
  if (code === "token_invalid") {
    return "That code isn't valid or has expired. Check the latest email or request a new one.";
  }
  if (code === "otp_expired" || m.includes("expired")) {
    return "That sign-in link has expired or was already used. Request a new one below.";
  }
  if (code === "signup_disabled" || m.includes("signups not allowed")) {
    return "We couldn't find an account for that email. New here? Enter your invitation code first.";
  }
  if (code === "over_email_send_rate_limit" || m.includes("rate limit") || m.includes("security purposes")) {
    return "Too many sign-in emails were requested. Please wait a minute and try again.";
  }
  if (code === "pkce" || m.includes("code verifier") || m.includes("flow state")) {
    return "Open the sign-in link in the same browser you requested it from, or enter the 6-digit code from the email.";
  }
  if (code === "email_address_invalid" || (m.includes("invalid") && m.includes("email"))) {
    return "That email address doesn't look right.";
  }
  return "We couldn't sign you in. Please try again.";
}
