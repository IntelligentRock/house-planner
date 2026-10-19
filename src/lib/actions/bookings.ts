"use server";

import { refresh } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMemberContext } from "@/lib/auth";
import { validateBookingInput, type BookingInput } from "@/lib/bookings/validation";
import { BOOKING_SELECT } from "@/lib/data";
import { dbErrorCode, friendlyDbError } from "@/lib/errors";
import type { ActionResult, BookingWithMember, ConflictInfo } from "@/lib/types";

const SIGNED_OUT: ActionResult<never> = {
  ok: false,
  code: "UNAUTHENTICATED",
  error: "Your session has ended or you no longer have access. Please sign in again.",
};

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Looks up what a rejected booking collided with, so the form can explain it. */
async function findConflict(
  supabase: SupabaseClient,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): Promise<ConflictInfo | undefined> {
  let query = supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("status", "confirmed")
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())
    .order("starts_at")
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  const hit = (data?.[0] ?? null) as BookingWithMember | null;
  if (!hit) return undefined;
  return {
    title: hit.title,
    memberName: hit.member?.display_name ?? "another member",
    startsAt: hit.starts_at,
    endsAt: hit.ends_at,
  };
}

async function conflictResult(
  supabase: SupabaseClient,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): Promise<ActionResult<never>> {
  const conflict = await findConflict(supabase, startsAt, endsAt, excludeId);
  return {
    ok: false,
    code: "BOOKING_CONFLICT",
    error: conflict
      ? `${conflict.memberName} has already booked part of that time.`
      : "Someone else has just booked part of that time.",
    conflict,
  };
}

export async function createBooking(input: BookingInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getMemberContext();
  if (!ctx) return SIGNED_OUT;

  const v = validateBookingInput(input);
  if (!v.ok) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: v.fieldErrors };
  const { title, notes, startsAt, endsAt } = v.value;

  // Owner is not sent: the column defaults to auth.uid() and clients have no
  // privilege to set it.
  const { data, error } = await ctx.supabase
    .from("bookings")
    .insert({ title, notes, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
    .select("id")
    .single();

  if (error) {
    if (dbErrorCode(error) === "BOOKING_CONFLICT") return conflictResult(ctx.supabase, startsAt, endsAt);
    return { ok: false, code: dbErrorCode(error), error: friendlyDbError(error) };
  }

  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function updateBooking(
  id: string,
  version: number,
  input: BookingInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getMemberContext();
  if (!ctx) return SIGNED_OUT;
  if (!isUuid(id) || !Number.isInteger(version)) return { ok: false, error: "Invalid request." };

  const isAdmin = ctx.profile.role === "admin";
  const v = validateBookingInput(input, { requireFutureEnd: !isAdmin });
  if (!v.ok) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: v.fieldErrors };
  const { title, notes, startsAt, endsAt } = v.value;

  // Only succeeds if nobody changed the booking since the form was opened.
  // RLS limits the update to the owner or an admin.
  const { data, error } = await ctx.supabase
    .from("bookings")
    .update({ title, notes, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
    .eq("id", id)
    .eq("version", version)
    .select("id");

  if (error) {
    if (dbErrorCode(error) === "BOOKING_CONFLICT") return conflictResult(ctx.supabase, startsAt, endsAt, id);
    return { ok: false, code: dbErrorCode(error), error: friendlyDbError(error) };
  }
  if (!data?.length) return explainNoRowsUpdated(ctx.supabase, id, ctx.user.id, isAdmin);

  refresh();
  return { ok: true, data: { id } };
}

export async function cancelBooking(id: string, version: number): Promise<ActionResult> {
  const ctx = await getMemberContext();
  if (!ctx) return SIGNED_OUT;
  if (!isUuid(id) || !Number.isInteger(version)) return { ok: false, error: "Invalid request." };

  const { data, error } = await ctx.supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("version", version)
    .select("id");

  if (error) return { ok: false, code: dbErrorCode(error), error: friendlyDbError(error) };
  if (!data?.length) return explainNoRowsUpdated(ctx.supabase, id, ctx.user.id, ctx.profile.role === "admin");

  refresh();
  return { ok: true, data: undefined };
}

/** An update matched no rows: work out why, without guessing. */
async function explainNoRowsUpdated(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  isAdmin: boolean,
): Promise<ActionResult<never>> {
  const { data } = await supabase.from("bookings").select("user_id, status").eq("id", id).maybeSingle();
  refresh();
  if (!data) return { ok: false, code: "NOT_FOUND", error: "This booking no longer exists." };
  if (data.status === "cancelled") {
    return { ok: false, code: "BOOKING_ALREADY_CANCELLED", error: "This booking has already been cancelled." };
  }
  if (data.user_id !== userId && !isAdmin) {
    return { ok: false, code: "FORBIDDEN", error: "You can only change your own bookings." };
  }
  return {
    ok: false,
    code: "STALE",
    error: "This booking was changed by someone else while you were editing. The calendar now shows the latest version; please review it and try again.",
  };
}
