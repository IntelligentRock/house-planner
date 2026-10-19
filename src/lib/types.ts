export type MemberRole = "member" | "admin";
export type MemberStatus = "active" | "revoked";
export type BookingStatus = "confirmed" | "cancelled";

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  avatar: string;
  color: string;
  role: MemberRole;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
};

/** The subset of a profile shown next to bookings. */
export type MemberSummary = Pick<Profile, "id" | "display_name" | "avatar" | "color">;

export type Booking = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  version: number;
  created_at: string;
  updated_at: string;
};

export type BookingWithMember = Booking & { member: MemberSummary | null };

export type Invitation = {
  id: string;
  code_hint: string;
  label: string | null;
  role: MemberRole;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type InvitationState = "active" | "used" | "expired" | "revoked";

export function invitationState(inv: Invitation, now: Date = new Date()): InvitationState {
  if (inv.revoked_at) return "revoked";
  if (inv.use_count >= inv.max_uses) return "used";
  if (inv.expires_at && new Date(inv.expires_at) <= now) return "expired";
  return "active";
}

/** Result shape returned by every Server Action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string>;
      conflict?: ConflictInfo;
    };

export type ConflictInfo = {
  title: string;
  memberName: string;
  startsAt: string;
  endsAt: string;
};
