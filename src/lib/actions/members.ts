"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getMemberContext } from "@/lib/auth";
import { AVATARS, DISPLAY_NAME_MAX, MEMBER_COLOR_KEYS } from "@/lib/constants";
import { dbErrorCode, friendlyDbError } from "@/lib/errors";
import type { ActionResult, MemberRole, MemberStatus } from "@/lib/types";

const SIGNED_OUT: ActionResult<never> = {
  ok: false,
  code: "UNAUTHENTICATED",
  error: "Your session has ended or you no longer have access. Please sign in again.",
};
const NOT_ADMIN: ActionResult<never> = { ok: false, code: "FORBIDDEN", error: "Only administrators can do that." };

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Your name can't be empty.")
    .max(DISPLAY_NAME_MAX, `Keep it under ${DISPLAY_NAME_MAX} characters.`),
  avatar: z.enum(AVATARS as [string, ...string[]], { error: "Pick one of the avatars." }),
  color: z.enum(MEMBER_COLOR_KEYS as [string, ...string[]], { error: "Pick one of the colours." }),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const ctx = await getMemberContext();
  if (!ctx) return SIGNED_OUT;

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  // Only these three columns are writable by members (column privileges + RLS).
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, avatar: parsed.data.avatar, color: parsed.data.color })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, error: friendlyDbError(error) };

  refresh();
  return { ok: true, data: undefined };
}

const inviteSchema = z.object({
  label: z.string().trim().max(80, "Keep the note under 80 characters.").optional(),
  role: z.enum(["member", "admin"]),
  maxUses: z.coerce.number().int().min(1).max(50),
  expiresInDays: z.coerce.number().int().min(0).max(365),
});

export async function createInvitation(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult<{ code: string }>> {
  const ctx = await getMemberContext();
  if (!ctx) return SIGNED_OUT;
  if (ctx.profile.role !== "admin") return NOT_ADMIN;

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the invitation settings." };
  const { label, role, maxUses, expiresInDays } = parsed.data;

  // The database re-checks that the caller is an admin.
  const { data, error } = await ctx.supabase.rpc("create_invitation", {
    p_label: label || null,
    p_role: role,
    p_max_uses: maxUses,
    p_expires_at: expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null,
  });
  if (error) return { ok: false, code: dbErrorCode(error), error: friendlyDbError(error) };

  refresh();
  return { ok: true, data: { code: (data as { code: string }[])[0].code } };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const ctx = await getMemberContext();
  if (!ctx) return SIGNED_OUT;
  if (ctx.profile.role !== "admin") return NOT_ADMIN;

  const { error } = await ctx.supabase.rpc("revoke_invitation", { p_invitation_id: id });
  if (error) return { ok: false, code: dbErrorCode(error), error: friendlyDbError(error) };

  refresh();
  return { ok: true, data: undefined };
}

export async function updateMember(
  userId: string,
  change: { role?: MemberRole; status?: MemberStatus },
): Promise<ActionResult> {
  const ctx = await getMemberContext();
  if (!ctx) return SIGNED_OUT;
  if (ctx.profile.role !== "admin") return NOT_ADMIN;

  const role = change.role && ["member", "admin"].includes(change.role) ? change.role : null;
  const status = change.status && ["active", "revoked"].includes(change.status) ? change.status : null;
  if (!role && !status) return { ok: false, error: "Nothing to change." };

  const { error } = await ctx.supabase.rpc("admin_update_member", {
    p_user_id: userId,
    p_role: role,
    p_status: status,
  });
  if (error) return { ok: false, code: dbErrorCode(error), error: friendlyDbError(error) };

  refresh();
  return { ok: true, data: undefined };
}
