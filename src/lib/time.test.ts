import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatDuration,
  formatRange,
  localToUtc,
  monthGrid,
  nightsBetween,
  shiftMonthKey,
  startOfLocalDay,
  utcToLocalParts,
  weekStartKey,
} from "./time";

const iso = (r: ReturnType<typeof localToUtc>) => (r.ok ? r.date.toISOString() : r.reason);

describe("localToUtc (Europe/Amsterdam)", () => {
  it("converts winter (CET, UTC+1) and summer (CEST, UTC+2) times", () => {
    expect(iso(localToUtc("2027-01-15", "14:30"))).toBe("2027-01-15T13:30:00.000Z");
    expect(iso(localToUtc("2027-07-15", "14:30"))).toBe("2027-07-15T12:30:00.000Z");
  });

  it("rejects wall-clock times skipped by the spring-forward change", () => {
    // 28 March 2027: 02:00 -> 03:00
    expect(localToUtc("2027-03-28", "02:00")).toEqual({ ok: false, reason: "nonexistent" });
    expect(localToUtc("2027-03-28", "02:59")).toEqual({ ok: false, reason: "nonexistent" });
    expect(iso(localToUtc("2027-03-28", "01:59"))).toBe("2027-03-28T00:59:00.000Z");
    expect(iso(localToUtc("2027-03-28", "03:00"))).toBe("2027-03-28T01:00:00.000Z");
  });

  it("resolves repeated autumn times to the first occurrence (CEST)", () => {
    // 31 October 2027: 03:00 -> 02:00, so 02:30 happens twice.
    expect(iso(localToUtc("2027-10-31", "02:30"))).toBe("2027-10-31T00:30:00.000Z");
    expect(iso(localToUtc("2027-10-31", "03:00"))).toBe("2027-10-31T02:00:00.000Z");
  });

  it("rejects malformed and impossible input", () => {
    expect(localToUtc("2027-02-30", "10:00").ok).toBe(false);
    expect(localToUtc("2027-13-01", "10:00").ok).toBe(false);
    expect(localToUtc("27-01-01", "10:00").ok).toBe(false);
    expect(localToUtc("2027-01-01", "24:00").ok).toBe(false);
    expect(localToUtc("2027-01-01", "9:00").ok).toBe(false);
    expect(localToUtc("", "").ok).toBe(false);
  });

  it("round-trips through utcToLocalParts", () => {
    for (const [d, t] of [
      ["2027-03-28", "03:00"],
      ["2027-10-31", "01:00"],
      ["2027-12-31", "23:45"],
      ["2028-02-29", "00:00"],
    ]) {
      const r = localToUtc(d, t);
      expect(r.ok).toBe(true);
      if (r.ok) expect(utcToLocalParts(r.date)).toEqual({ date: d, time: t });
    }
  });
});

describe("day helpers", () => {
  it("uses Amsterdam days, not UTC days", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Amsterdam.
    expect(dayKey("2026-12-31T23:30:00Z")).toBe("2027-01-01");
    expect(startOfLocalDay("2027-01-01").toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(startOfLocalDay("2027-07-01").toISOString()).toBe("2027-06-30T22:00:00.000Z");
  });

  it("counts nights across DST changes", () => {
    const fri = localToUtc("2027-10-29", "15:00");
    const mon = localToUtc("2027-11-01", "11:00");
    expect(fri.ok && mon.ok && nightsBetween(fri.date, mon.date)).toBe(3);
  });

  it("formats ranges and durations Dutch-style", () => {
    const a = localToUtc("2027-10-29", "15:00");
    const b = localToUtc("2027-10-31", "11:00");
    const c = localToUtc("2027-10-29", "18:30");
    if (!a.ok || !b.ok || !c.ok) throw new Error();
    expect(formatRange(a.date, b.date)).toBe("Fri 29 Oct 15:00 – Sun 31 Oct 11:00");
    expect(formatRange(a.date, c.date)).toBe("Fri 29 Oct, 15:00 – 18:30");
    expect(formatDuration(a.date, b.date)).toBe("2 nights");
    expect(formatDuration(a.date, c.date)).toBe("3 h 30 min");
  });
});

describe("calendar grid", () => {
  it("builds Monday-first weeks covering the month", () => {
    const weeks = monthGrid("2027-02"); // 1 Feb 2027 is a Monday
    expect(weeks[0][0]).toBe("2027-02-01");
    expect(weeks.at(-1)!.at(-1)).toBe("2027-02-28");
    expect(weeks).toHaveLength(4);

    const oct = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday
    expect(oct[0][0]).toBe("2026-09-28");
    expect(oct.every((w) => w.length === 7)).toBe(true);
  });

  it("navigates months and weeks", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2027-01", -1)).toBe("2026-12");
    expect(weekStartKey("2026-10-18")).toBe("2026-10-12"); // Sunday -> Monday
    expect(weekStartKey("2026-10-19")).toBe("2026-10-19");
  });
});
