import { describe, expect, it } from "vitest";
import { localToUtc } from "@/lib/time";
import type { BookingWithMember } from "@/lib/types";
import { bookingsOnDay, dayBlocks, layoutWeek, lastDayKey } from "./layout";

const at = (d: string, t: string) => {
  const r = localToUtc(d, t);
  if (!r.ok) throw new Error("bad time");
  return r.date.toISOString();
};

function booking(id: string, start: [string, string], end: [string, string]): BookingWithMember {
  return {
    id,
    user_id: "u",
    title: id,
    notes: null,
    starts_at: at(...start),
    ends_at: at(...end),
    status: "confirmed",
    version: 1,
    created_at: "",
    updated_at: "",
    member: null,
  };
}

// Week of Monday 12 October 2026
const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];

describe("month view layout", () => {
  it("treats a booking ending at midnight as not touching the next day", () => {
    expect(lastDayKey(booking("a", ["2026-10-12", "10:00"], ["2026-10-13", "00:00"]))).toBe("2026-10-12");
  });

  it("puts a same-day checkout and check-in in separate lanes", () => {
    const out = booking("out", ["2026-10-12", "15:00"], ["2026-10-14", "11:00"]);
    const inn = booking("in", ["2026-10-14", "15:00"], ["2026-10-16", "11:00"]);
    const segs = layoutWeek(week, [inn, out]);
    const byId = Object.fromEntries(segs.map((s) => [s.booking.id, s]));
    expect(byId.out).toMatchObject({ col: 0, span: 3, lane: 0 });
    expect(byId.in).toMatchObject({ col: 2, span: 3, lane: 1 });
  });

  it("reuses a lane once it is free again", () => {
    const a = booking("a", ["2026-10-12", "10:00"], ["2026-10-12", "12:00"]);
    const b = booking("b", ["2026-10-14", "10:00"], ["2026-10-14", "12:00"]);
    expect(layoutWeek(week, [a, b]).map((s) => s.lane)).toEqual([0, 0]);
  });

  it("clips bookings that continue beyond the week", () => {
    const long = booking("long", ["2026-10-08", "15:00"], ["2026-10-21", "11:00"]);
    const [seg] = layoutWeek(week, [long]);
    expect(seg).toMatchObject({ col: 0, span: 7, continuesBefore: true, continuesAfter: true, startsThisWeek: false });
  });

  it("finds bookings on a given day", () => {
    const a = booking("a", ["2026-10-12", "15:00"], ["2026-10-14", "11:00"]);
    expect(bookingsOnDay("2026-10-13", [a])).toHaveLength(1);
    expect(bookingsOnDay("2026-10-15", [a])).toHaveLength(0);
  });
});

describe("week view blocks", () => {
  it("positions blocks by Amsterdam wall-clock time", () => {
    const a = booking("a", ["2026-10-12", "06:00"], ["2026-10-12", "18:00"]);
    const [blk] = dayBlocks("2026-10-12", [a]);
    expect(blk.top).toBeCloseTo(0.25);
    expect(blk.height).toBeCloseTo(0.5);
  });

  it("splits overnight stays across days", () => {
    const a = booking("a", ["2026-10-12", "18:00"], ["2026-10-13", "06:00"]);
    const [first] = dayBlocks("2026-10-12", [a]);
    const [second] = dayBlocks("2026-10-13", [a]);
    expect(first).toMatchObject({ startsToday: true, endsToday: false });
    expect(first.top + first.height).toBeCloseTo(1);
    expect(second).toMatchObject({ startsToday: false, endsToday: true, top: 0 });
    expect(second.height).toBeCloseTo(0.25);
  });
});
