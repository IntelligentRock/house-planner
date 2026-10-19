import "server-only";
import { cookies } from "next/headers";

/**
 * Remembers a checked invitation code between "enter code" and finishing
 * enrolment (the magic link may take a minute to arrive). It grants nothing:
 * the code is validated and consumed in the database at enrolment.
 */
const INVITE_COOKIE = "hp_invite";

export async function getStoredInviteCode() {
  return (await cookies()).get(INVITE_COOKIE)?.value ?? null;
}

export async function storeInviteCode(code: string) {
  (await cookies()).set(INVITE_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function clearInviteCode() {
  (await cookies()).delete(INVITE_COOKIE);
}
