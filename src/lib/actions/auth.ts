"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer, homeFor } from "@/lib/auth";
import { AVATARS, DISPLAY_NAME_MAX } from "@/lib/constants";
import { dbErrorCode, friendlyAuthError, friendlyDbError } from "@/lib/errors";
import { clearInviteCode, getStoredInviteCode, storeInviteCode } from "@/lib/invite-cookie";
import { looksLikeInviteCode, normalizeInviteCode } from "@/lib/invitations";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function checkCode(code: string) {
  if (!looksLikeInviteCode(code)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_invitation", { p_code: normalizeInviteCode(code) });
  return !error && data === true;
}

export async function verifyInvitation(code: string): Promise<ActionResult> {
  if (!(await checkCode(code))) {
    return {
      ok: false,
      fieldErrors: { code: "That code isn't valid, has expired or has already been used." },
      error: "That invitation code can't be used.",
    };
  }
  await storeInviteCode(normalizeInviteCode(code));
  return { ok: true, data: undefined };
}

const emailSchema = z.email("Enter a valid email address.").max(254);

/**
 * Sends a magic link + one-time code. New accounts may only be created while
 * holding a valid invitation; otherwise only existing accounts get an email.
 * (This is friction for outsiders, not the security boundary: without a
 * redeemed invitation an account can read nothing.)
 */
export async function sendSignInEmail(rawEmail: string): Promise<ActionResult<{ email: string }>> {
  const parsed = emailSchema.safeParse(rawEmail.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address." } };
  const email = parsed.data;

  const invite = await getStoredInviteCode();
  const enrolling = invite !== null && (await checkCode(invite));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: enrolling,
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=${enrolling ? "/onboarding" : "/calendar"}`,
    },
  });

  if (error) {
    return { ok: false, code: error.code, error: friendlyAuthError(error.code, error.message) };
  }
  return { ok: true, data: { email } };
}

/** Signs in with the 6-digit code from the email (handy when the link opens in another browser). */
export async function verifyEmailCode(rawEmail: string, rawToken: string): Promise<ActionResult> {
  const email = rawEmail.trim().toLowerCase();
  const token = rawToken.replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) {
    return { ok: false, error: "Enter the code from the email.", fieldErrors: { token: "Enter the code from the email." } };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { ok: false, error: friendlyAuthError("token_invalid", error.message), fieldErrors: { token: "That code didn't work." } };
  }
  redirect(homeFor(await freshViewer()));
}

/** getViewer() is memoised per request; after signing in we need a new look. */
async function freshViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return { supabase, user: null, profile: null } as const;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return { supabase, user: { id, email: "" }, profile } as const;
}

const onboardingSchema = z.object({
  code: z.string().trim().min(1, "Enter your invitation code."),
  displayName: z
    .string()
    .trim()
    .min(1, "Choose a name the family will recognise.")
    .max(DISPLAY_NAME_MAX, `Keep it under ${DISPLAY_NAME_MAX} characters.`),
  avatar: z.enum(AVATARS as [string, ...string[]], { error: "Pick an avatar." }),
});

export async function completeOnboarding(input: z.input<typeof onboardingSchema>): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.user) return { ok: false, code: "UNAUTHENTICATED", error: "Your session has ended. Please sign in again." };
  if (viewer.profile) redirect(homeFor(viewer));

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  const { error } = await viewer.supabase.rpc("redeem_invitation", {
    p_code: normalizeInviteCode(parsed.data.code),
    p_display_name: parsed.data.displayName,
    p_avatar: parsed.data.avatar,
  });

  if (error) {
    const code = dbErrorCode(error);
    if (code === "ALREADY_ENROLLED") redirect("/calendar");
    const onCode = code?.startsWith("INVITATION_");
    return {
      ok: false,
      code,
      error: friendlyDbError(error),
      fieldErrors: onCode ? { code: friendlyDbError(error) } : undefined,
    };
  }

  await clearInviteCode();
  redirect("/calendar?welcome=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in?signed-out=1");
}
