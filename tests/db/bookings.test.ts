import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { localToUtc } from "@/lib/time";
import { clearBookings, createAdmin, createMember, futureBase, service, slot, type TestUser } from "./helpers";

let admin: TestUser;
let alice: TestUser;
let bob: TestUser;
let base: Date;

beforeAll(async () => {
  admin = await createAdmin();
  alice = await createMember(admin, "Alice");
  bob = await createMember(admin, "Bob");
});

beforeEach(async () => {
  await clearBookings();
  base = futureBase(10);
});

function book(user: TestUser, interval: { starts_at: string; ends_at: string }, title = "Stay") {
  return user.client.from("bookings").insert({ title, ...interval }).select().single();
}

function local(date: string, time: string) {
  const r = localToUtc(date, time);
  if (!r.ok) throw new Error(`bad local time ${date} ${time}`);
  return r.date.toISOString();
}

describe("creating bookings", () => {
  it("stores the booking owned by the signed-in member", async () => {
    const { data, error } = await book(alice, slot(base, 0, 24), "Weekend stay");
    expect(error).toBeNull();
    expect(data).toMatchObject({ user_id: alice.id, title: "Weekend stay", status: "confirmed", version: 1 });
  });

  it("ignores attempts to book on behalf of someone else", async () => {
    const { error } = await alice.client
      .from("bookings")
      .insert({ title: "Fake", user_id: bob.id, ...slot(base, 0, 2) });
    expect(error).not.toBeNull();
  });

  it("cannot forge server-managed fields", async () => {
    for (const extra of [{ status: "cancelled" }, { version: 99 }, { created_at: "2000-01-01T00:00:00Z" }]) {
      const { error } = await alice.client.from("bookings").insert({ title: "x", ...slot(base, 0, 2), ...extra });
      expect(error, JSON.stringify(extra)).not.toBeNull();
    }
  });

  it("rejects end before start, zero length and too-short bookings", async () => {
    const start = base.toISOString();
    const before = new Date(base.getTime() - 3_600_000).toISOString();
    const tenMin = new Date(base.getTime() + 10 * 60_000).toISOString();
    expect((await book(alice, { starts_at: start, ends_at: before })).error?.code).toBe("23514");
    expect((await book(alice, { starts_at: start, ends_at: start })).error?.code).toBe("23514");
    expect((await book(alice, { starts_at: start, ends_at: tenMin })).error?.code).toBe("23514");
  });

  it("rejects bookings longer than 62 days", async () => {
    expect((await book(alice, slot(base, 0, 63 * 24))).error?.code).toBe("23514");
  });

  it("rejects bookings that are already over", async () => {
    const past = slot(new Date(Date.now() - 48 * 3_600_000), 0, 2);
    expect((await book(alice, past)).error?.message).toBe("BOOKING_IN_PAST");
  });

  it("rejects missing or blank titles", async () => {
    expect((await book(alice, slot(base, 0, 2), "   ")).error).not.toBeNull();
    expect((await book(alice, slot(base, 0, 2), "")).error).not.toBeNull();
  });
});

describe("conflict prevention", () => {
  it("rejects an overlapping booking from another member", async () => {
    expect((await book(alice, slot(base, 0, 48))).error).toBeNull();
    const { error } = await book(bob, slot(base, 24, 48));
    expect(error?.code).toBe("23P01");
  });

  it("rejects bookings fully inside or around an existing one", async () => {
    expect((await book(alice, slot(base, 10, 10))).error).toBeNull();
    expect((await book(bob, slot(base, 12, 2))).error?.code).toBe("23P01");
    expect((await book(bob, slot(base, 0, 48))).error?.code).toBe("23P01");
    expect((await book(alice, slot(base, 10, 10))).error?.code).toBe("23P01");
  });

  it("accepts adjacent bookings (half-open intervals)", async () => {
    expect((await book(alice, slot(base, 0, 24))).error).toBeNull();
    expect((await book(bob, slot(base, 24, 24))).error).toBeNull(); // starts exactly at the previous end
    expect((await book(bob, slot(base, -3, 3))).error).toBeNull(); // ends exactly at the first start
  });

  it("lets a cancelled booking's time be booked again", async () => {
    const { data } = await book(alice, slot(base, 0, 24));
    await alice.client.from("bookings").update({ status: "cancelled" }).eq("id", data!.id);
    expect((await book(bob, slot(base, 0, 24))).error).toBeNull();
  });

  it("accepts exactly one of many simultaneous overlapping requests", async () => {
    const members = [alice, bob, admin, alice, bob, admin, alice, bob];
    const results = await Promise.all(members.map((m, i) => book(m, slot(base, i, 12), `Race ${i}`)));
    const ok = results.filter((r) => r.error === null);
    expect(ok).toHaveLength(1);
    expect(results.filter((r) => r.error?.code === "23P01")).toHaveLength(members.length - 1);
    const { count } = await service
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed");
    expect(count).toBe(1);
  });

  it("rejects an edit that would overlap another booking", async () => {
    await book(alice, slot(base, 0, 24));
    const { data: mine } = await book(bob, slot(base, 48, 24));
    const { error } = await bob.client
      .from("bookings")
      .update(slot(base, 12, 24))
      .eq("id", mine!.id)
      .select()
      .single();
    expect(error?.code).toBe("23P01");
  });
});

describe("editing and cancelling", () => {
  it("lets owners edit their own booking and bumps the version", async () => {
    const { data } = await book(alice, slot(base, 0, 24));
    const { data: updated, error } = await alice.client
      .from("bookings")
      .update({ title: "Longer stay", ...slot(base, 0, 30) })
      .eq("id", data!.id)
      .eq("version", 1)
      .select()
      .single();
    expect(error).toBeNull();
    expect(updated).toMatchObject({ title: "Longer stay", version: 2 });
  });

  it("detects concurrent edits through the version check", async () => {
    const { data } = await book(alice, slot(base, 0, 24));
    await alice.client.from("bookings").update({ title: "First edit" }).eq("id", data!.id).eq("version", 1);
    const { data: stale } = await alice.client
      .from("bookings")
      .update({ title: "Stale edit" })
      .eq("id", data!.id)
      .eq("version", 1)
      .select();
    expect(stale).toEqual([]);
    const { data: row } = await service.from("bookings").select("title, version").eq("id", data!.id).single();
    expect(row).toEqual({ title: "First edit", version: 2 });
  });

  it("does not let members edit or cancel someone else's booking", async () => {
    const { data } = await book(alice, slot(base, 0, 24), "Alice's stay");
    const edit = await bob.client.from("bookings").update({ title: "Bob's now" }).eq("id", data!.id).select();
    const cancel = await bob.client.from("bookings").update({ status: "cancelled" }).eq("id", data!.id).select();
    expect(edit.data).toEqual([]);
    expect(cancel.data).toEqual([]);
    const { data: row } = await service.from("bookings").select("title, status").eq("id", data!.id).single();
    expect(row).toEqual({ title: "Alice's stay", status: "confirmed" });
  });

  it("does not let anyone reassign a booking or delete rows", async () => {
    const { data } = await book(alice, slot(base, 0, 24));
    expect((await alice.client.from("bookings").update({ user_id: bob.id }).eq("id", data!.id)).error).not.toBeNull();
    await alice.client.from("bookings").delete().eq("id", data!.id);
    await admin.client.from("bookings").delete().eq("id", data!.id);
    expect((await service.from("bookings").select("id").eq("id", data!.id)).data).toHaveLength(1);
  });

  it("lets owners cancel, recording who cancelled and when", async () => {
    const { data } = await book(alice, slot(base, 0, 24));
    const { data: cancelled, error } = await alice.client
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data!.id)
      .select()
      .single();
    expect(error).toBeNull();
    expect(cancelled).toMatchObject({ status: "cancelled", cancelled_by: alice.id });
    expect(cancelled.cancelled_at).toBeTruthy();
  });

  it("does not allow reviving or editing a cancelled booking", async () => {
    const { data } = await book(alice, slot(base, 0, 24));
    await alice.client.from("bookings").update({ status: "cancelled" }).eq("id", data!.id);
    const revive = await alice.client.from("bookings").update({ status: "confirmed" }).eq("id", data!.id);
    expect(revive.error?.message).toBe("BOOKING_ALREADY_CANCELLED");
  });

  it("lets administrators edit and cancel any booking", async () => {
    const { data } = await book(alice, slot(base, 0, 24));
    const edit = await admin.client
      .from("bookings")
      .update({ title: "Adjusted by admin" })
      .eq("id", data!.id)
      .select()
      .single();
    expect(edit.error).toBeNull();
    expect(edit.data.user_id).toBe(alice.id);
    const cancel = await admin.client
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data!.id)
      .select()
      .single();
    expect(cancel.data).toMatchObject({ status: "cancelled", cancelled_by: admin.id });
  });

  it("does not let members change bookings that have already ended", async () => {
    const { data } = await service
      .from("bookings")
      .insert({
        user_id: alice.id,
        title: "Last summer",
        ...slot(new Date(Date.now() - 30 * 24 * 3_600_000), 0, 48),
      })
      .select()
      .single();
    const { error } = await alice.client.from("bookings").update({ title: "Rewrite history" }).eq("id", data!.id);
    expect(error?.message).toBe("BOOKING_ALREADY_ENDED");
  });
});

describe("timezone handling (Europe/Amsterdam)", () => {
  it("stores a stay across the October DST change with the right absolute times", async () => {
    // Clocks go back 03:00 CEST -> 02:00 CET on Sunday 31 October 2027.
    const interval = { starts_at: local("2027-10-30", "15:00"), ends_at: local("2027-11-01", "11:00") };
    expect(interval.starts_at).toBe("2027-10-30T13:00:00.000Z"); // CEST, UTC+2
    expect(interval.ends_at).toBe("2027-11-01T10:00:00.000Z"); // CET, UTC+1
    const { data, error } = await book(alice, interval);
    expect(error).toBeNull();
    expect(new Date(data!.starts_at).toISOString()).toBe(interval.starts_at);
    expect(new Date(data!.ends_at).toISOString()).toBe(interval.ends_at);
  });

  it("treats adjacency across the March DST change correctly", async () => {
    // Clocks jump 02:00 CET -> 03:00 CEST on Sunday 28 March 2027; 01:59 and 03:00 are one minute apart.
    const first = { starts_at: local("2027-03-27", "12:00"), ends_at: local("2027-03-28", "03:00") };
    const second = { starts_at: local("2027-03-28", "03:00"), ends_at: local("2027-03-28", "12:00") };
    expect(first.ends_at).toBe("2027-03-28T01:00:00.000Z");
    expect((await book(alice, first)).error).toBeNull();
    expect((await book(bob, second)).error).toBeNull();
    const overlapping = { starts_at: local("2027-03-28", "01:30"), ends_at: local("2027-03-28", "04:00") };
    expect((await book(bob, overlapping)).error?.code).toBe("23P01");
  });
});
