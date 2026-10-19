import { describe, expect, it } from "vitest";
import { validateBookingInput } from "./validation";

const now = new Date("2027-06-01T10:00:00Z");
const valid = {
  title: "Weekend stay",
  notes: "",
  startDate: "2027-06-04",
  startTime: "15:00",
  endDate: "2027-06-06",
  endTime: "11:00",
};

function errors(input: Partial<typeof valid>) {
  const r = validateBookingInput({ ...valid, ...input }, { now });
  return r.ok ? {} : r.fieldErrors;
}

describe("validateBookingInput", () => {
  it("accepts a valid stay and converts to absolute times", () => {
    const r = validateBookingInput(valid, { now });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.startsAt.toISOString()).toBe("2027-06-04T13:00:00.000Z");
      expect(r.value.endsAt.toISOString()).toBe("2027-06-06T09:00:00.000Z");
      expect(r.value.notes).toBeNull();
      expect(r.value.title).toBe("Weekend stay");
    }
  });

  it("trims the title and requires it", () => {
    expect(errors({ title: "   " }).title).toBeDefined();
    const r = validateBookingInput({ ...valid, title: "  Visit  " }, { now });
    expect(r.ok && r.value.title).toBe("Visit");
  });

  it("limits title and notes length", () => {
    expect(errors({ title: "x".repeat(81) }).title).toBeDefined();
    expect(errors({ notes: "x".repeat(2001) }).notes).toBeDefined();
  });

  it("requires the end to be after the start", () => {
    expect(errors({ endDate: "2027-06-04", endTime: "15:00" }).endTime).toMatch(/after the start/);
    expect(errors({ endDate: "2027-06-03" }).endTime).toMatch(/after the start/);
  });

  it("enforces a minimum and maximum length", () => {
    expect(errors({ endDate: "2027-06-04", endTime: "15:10" }).endTime).toMatch(/at least 15 minutes/);
    expect(errors({ endDate: "2027-08-10" }).endTime).toMatch(/at most 62 days/);
    expect(errors({ endDate: "2027-06-04", endTime: "15:15" })).toEqual({});
  });

  it("rejects bookings that are already over", () => {
    expect(errors({ startDate: "2027-05-01", endDate: "2027-05-02" }).endTime).toMatch(/already be over/);
  });

  it("allows past end dates when editing is not restricted (admin edits)", () => {
    const r = validateBookingInput({ ...valid, startDate: "2027-05-01", endDate: "2027-05-02" }, { now, requireFutureEnd: false });
    expect(r.ok).toBe(true);
  });

  it("explains nonexistent DST times", () => {
    const r = validateBookingInput(
      { ...valid, startDate: "2027-03-28", startTime: "02:30", endDate: "2027-03-28", endTime: "12:00" },
      { now: new Date("2027-03-01T00:00:00Z") },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.startTime).toMatch(/02:00 to 03:00/);
  });

  it("accepts a short visit across the autumn DST change and measures real elapsed time", () => {
    // 01:30 -> 03:30 on 31 Oct 2027 is three real hours because 02:00–03:00 repeats.
    const r = validateBookingInput(
      { ...valid, startDate: "2027-10-31", startTime: "01:30", endDate: "2027-10-31", endTime: "03:30" },
      { now: new Date("2027-10-01T00:00:00Z") },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.endsAt.getTime() - r.value.startsAt.getTime()).toBe(3 * 3_600_000);
  });

  it("reports missing fields", () => {
    const r = validateBookingInput({ title: "x" }, { now });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(expect.arrayContaining(["startDate", "endTime"]));
  });
});
