import { beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  clearBookings,
  createAdmin,
  createMember,
  createUser,
  futureBase,
  service,
  slot,
  type TestUser,
} from "./helpers";

let admin: TestUser;
let member: TestUser;
let outsider: TestUser; // signed up, never redeemed an invitation
let bookingId: string;

beforeAll(async () => {
  await clearBookings();
  admin = await createAdmin();
  member = await createMember(admin, "Member A");
  outsider = await createUser("outsider");
  const { data, error } = await member.client
    .from("bookings")
    .insert({ title: "Weekend stay", ...slot(futureBase(30), 0, 48) })
    .select()
    .single();
  if (error) throw error;
  bookingId = data.id;
});

describe("unauthenticated visitors", () => {
  it("cannot read or write any private data", async () => {
    const anon = anonClient();
    for (const table of ["profiles", "bookings", "invitations", "invitation_redemptions"]) {
      const { data, error } = await anon.from(table).select("*");
      expect(error ?? (data?.length === 0 ? null : "leak")).not.toBe("leak");
      expect(data ?? []).toEqual([]);
    }
    const insert = await anon.from("bookings").insert({ title: "x", ...slot(futureBase(60), 0, 2) });
    expect(insert.error).not.toBeNull();
  });
});

describe("signed-in accounts without an invitation", () => {
  it("see no profiles, bookings or invitations", async () => {
    expect((await outsider.client.from("profiles").select("*")).data).toEqual([]);
    expect((await outsider.client.from("bookings").select("*")).data).toEqual([]);
    expect((await outsider.client.from("invitations").select("id")).data).toEqual([]);
  });

  it("cannot create bookings", async () => {
    const { error } = await outsider.client.from("bookings").insert({ title: "Sneaky", ...slot(futureBase(90), 0, 2) });
    expect(error).not.toBeNull();
  });

  it("cannot create a profile directly", async () => {
    const { error } = await outsider.client.from("profiles").insert({
      id: outsider.id,
      email: outsider.email,
      display_name: "Sneaky",
      avatar: "avatar-01",
      color: "sage",
      role: "admin",
    });
    expect(error).not.toBeNull();
    expect((await service.from("profiles").select("id").eq("id", outsider.id)).data).toEqual([]);
  });

  it("cannot modify existing bookings", async () => {
    const { data } = await outsider.client.from("bookings").update({ title: "Hijacked" }).eq("id", bookingId).select();
    expect(data ?? []).toEqual([]);
    const { data: row } = await service.from("bookings").select("title").eq("id", bookingId).single();
    expect(row!.title).toBe("Weekend stay");
  });
});

describe("members", () => {
  it("can read every member's profile and all bookings", async () => {
    const { data: profiles } = await member.client.from("profiles").select("id");
    expect(profiles!.map((p) => p.id)).toEqual(expect.arrayContaining([admin.id, member.id]));
    const { data: bookings } = await member.client.from("bookings").select("id");
    expect(bookings!.map((b) => b.id)).toContain(bookingId);
  });

  it("can update their own display name, avatar and colour", async () => {
    const { data, error } = await member.client
      .from("profiles")
      .update({ display_name: "Renamed", avatar: "avatar-07", color: "plum" })
      .eq("id", member.id)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ display_name: "Renamed", avatar: "avatar-07", color: "plum" });
  });

  it("cannot promote themselves or change their status or email", async () => {
    for (const patch of [{ role: "admin" }, { status: "active" }, { email: "x@evil.test" }, { id: admin.id }]) {
      const { error } = await member.client.from("profiles").update(patch).eq("id", member.id);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
    const { data } = await service.from("profiles").select("role, email").eq("id", member.id).single();
    expect(data).toMatchObject({ role: "member", email: member.email });
  });

  it("cannot edit someone else's profile", async () => {
    const { data } = await member.client.from("profiles").update({ display_name: "Pwned" }).eq("id", admin.id).select();
    expect(data).toEqual([]);
    const { data: row } = await service.from("profiles").select("display_name").eq("id", admin.id).single();
    expect(row!.display_name).toBe("Test Admin");
  });

  it("cannot delete profiles", async () => {
    await member.client.from("profiles").delete().eq("id", admin.id);
    expect((await service.from("profiles").select("id").eq("id", admin.id)).data).toHaveLength(1);
  });

  it("cannot use the admin member function", async () => {
    const { error } = await member.client.rpc("admin_update_member", {
      p_user_id: member.id,
      p_role: "admin",
      p_status: null,
    });
    expect(error?.message).toBe("FORBIDDEN");
  });
});

describe("administrators", () => {
  it("can change another member's role", async () => {
    const other = await createMember(admin, "Promotable");
    const { data, error } = await admin.client.rpc("admin_update_member", {
      p_user_id: other.id,
      p_role: "admin",
      p_status: null,
    });
    expect(error).toBeNull();
    expect(data.role).toBe("admin");
    // The newly promoted admin can now manage invitations.
    expect((await other.client.rpc("create_invitation", {})).error).toBeNull();
  });

  it("cannot change their own role or access", async () => {
    const { error } = await admin.client.rpc("admin_update_member", {
      p_user_id: admin.id,
      p_role: "member",
      p_status: null,
    });
    expect(error?.message).toBe("CANNOT_CHANGE_SELF");
  });

  it("can revoke a member's access, which cuts off all data immediately", async () => {
    const leaver = await createMember(admin, "Leaver");
    expect((await leaver.client.from("bookings").select("id")).data!.length).toBeGreaterThan(0);

    const { error } = await admin.client.rpc("admin_update_member", {
      p_user_id: leaver.id,
      p_role: null,
      p_status: "revoked",
    });
    expect(error).toBeNull();

    expect((await leaver.client.from("bookings").select("id")).data).toEqual([]);
    const { data: profiles } = await leaver.client.from("profiles").select("id, status");
    expect(profiles).toEqual([{ id: leaver.id, status: "revoked" }]);
    const insert = await leaver.client.from("bookings").insert({ title: "Still here?", ...slot(futureBase(120), 0, 2) });
    expect(insert.error).not.toBeNull();
    const update = await leaver.client.from("profiles").update({ display_name: "Back" }).eq("id", leaver.id).select();
    expect(update.data ?? []).toEqual([]);

    // Restoring access works too.
    await admin.client.rpc("admin_update_member", { p_user_id: leaver.id, p_role: null, p_status: "active" });
    expect((await leaver.client.from("bookings").select("id")).data!.length).toBeGreaterThan(0);
  });

  it("see invitation redemptions; members do not", async () => {
    expect((await admin.client.from("invitation_redemptions").select("user_id")).data!.length).toBeGreaterThan(0);
    expect((await member.client.from("invitation_redemptions").select("user_id")).data).toEqual([]);
  });
});
