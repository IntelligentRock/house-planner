import { describe, expect, it } from "vitest";
import { currentBooking, nextAvailability, nextBooking, overlaps } from "./availability";

const b = (start: string, end: string) => ({ starts_at: `2027-06-${start}:00Z`, ends_at: `2027-06-${end}:00Z` });
const at = (s: string) => new Date(`2027-06-${s}:00Z`);

describe("overlaps (half-open intervals)", () => {
  it("treats touching intervals as non-overlapping", () => {
    expect(overlaps(b("01T10:00", "02T11:00"), b("02T11:00", "03T11:00"))).toBe(false);
    expect(overlaps(b("02T11:00", "03T11:00"), b("01T10:00", "02T11:00"))).toBe(false);
  });

  it("detects partial, contained and identical overlaps", () => {
    expect(overlaps(b("01T10:00", "02T12:00"), b("02T11:00", "03T11:00"))).toBe(true);
    expect(overlaps(b("01T00:00", "05T00:00"), b("02T00:00", "03T00:00"))).toBe(true);
    expect(overlaps(b("01T00:00", "02T00:00"), b("01T00:00", "02T00:00"))).toBe(true);
  });
});

describe("availability summary", () => {
  const bookings = [b("10T15:00", "12T11:00"), b("12T11:00", "13T11:00"), b("20T15:00", "22T11:00")];

  it("finds the current and next booking", () => {
    expect(currentBooking(bookings, at("11T09:00"))).toBe(bookings[0]);
    expect(currentBooking(bookings, at("12T11:00"))).toBe(bookings[1]); // end exclusive
    expect(currentBooking(bookings, at("15T00:00"))).toBeNull();
    expect(nextBooking(bookings, at("15T00:00"))).toBe(bookings[2]);
    expect(nextBooking(bookings, at("23T00:00"))).toBeNull();
  });

  it("is available now when nothing is happening", () => {
    const r = nextAvailability(bookings, at("05T00:00"));
    expect(r).toEqual({ from: at("05T00:00"), until: at("10T15:00") });
  });

  it("chains back-to-back bookings when computing the next free moment", () => {
    const r = nextAvailability(bookings, at("11T00:00"));
    expect(r).toEqual({ from: at("13T11:00"), until: at("20T15:00") });
  });

  it("has no end when nothing else is booked", () => {
    expect(nextAvailability(bookings, at("21T00:00"))).toEqual({ from: at("22T11:00"), until: null });
    expect(nextAvailability([], at("21T00:00"))).toEqual({ from: at("21T00:00"), until: null });
  });

  it("ignores input order", () => {
    const shuffled = [bookings[2], bookings[1], bookings[0]];
    expect(nextAvailability(shuffled, at("11T00:00")).from).toEqual(at("13T11:00"));
  });
});
