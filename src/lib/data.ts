import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingWithMember, Invitation, MemberSummary, Profile } from "@/lib/types";

/** Bookings embed their owner. Two FKs point at profiles, so name the one we want. */
export const BOOKING_SELECT =
  "*, member:profiles!bookings_user_id_fkey(id, display_name, avatar, color)" as const;

export class DataError extends Error {}

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new DataError(`Could not load ${what}.`);
  return (result.data ?? []) as T;
}

/** Confirmed bookings overlapping [from, to). */
export async function getBookingsInRange(supabase: SupabaseClient, from: Date, to: Date) {
  const result = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("status", "confirmed")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString())
    .order("starts_at");
  return check<BookingWithMember[]>(result, "bookings");
}

/** Confirmed bookings that have not ended yet, soonest first. */
export async function getUpcomingBookings(supabase: SupabaseClient, opts: { userId?: string; limit?: number } = {}) {
  let query = supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("status", "confirmed")
    .gt("ends_at", new Date().toISOString())
    .order("starts_at");
  if (opts.userId) query = query.eq("user_id", opts.userId);
  if (opts.limit) query = query.limit(opts.limit);
  return check<BookingWithMember[]>(await query, "upcoming bookings");
}

export async function getPastBookings(supabase: SupabaseClient, opts: { userId?: string; limit?: number } = {}) {
  let query = supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("status", "confirmed")
    .lte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.userId) query = query.eq("user_id", opts.userId);
  return check<BookingWithMember[]>(await query, "past bookings");
}

export async function getBooking(supabase: SupabaseClient, id: string) {
  const result = await supabase.from("bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle();
  if (result.error) throw new DataError("Could not load the booking.");
  return result.data as BookingWithMember | null;
}

export async function getActiveMembers(supabase: SupabaseClient) {
  const result = await supabase
    .from("profiles")
    .select("id, display_name, avatar, color")
    .eq("status", "active")
    .order("display_name");
  return check<MemberSummary[]>(result, "members");
}

export async function getAllProfiles(supabase: SupabaseClient) {
  const result = await supabase.from("profiles").select("*").order("display_name");
  return check<Profile[]>(result, "members");
}

/** Admin only (enforced by RLS: other users get an empty list). */
export async function getInvitations(supabase: SupabaseClient) {
  const result = await supabase
    .from("invitations")
    .select("id, code_hint, label, role, max_uses, use_count, expires_at, revoked_at, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return check<Invitation[]>(result, "invitations");
}

/** Number of confirmed bookings per member (for the members page). */
export async function getBookingCounts(supabase: SupabaseClient) {
  const result = await supabase
    .from("bookings")
    .select("user_id")
    .eq("status", "confirmed")
    .gt("ends_at", new Date().toISOString());
  const rows = check<{ user_id: string }[]>(result, "booking counts");
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  return counts;
}
