import { addDaysToKey, dayKey, inZone } from "@/lib/time";
import type { BookingWithMember } from "@/lib/types";

/** Last calendar day a booking touches (its end is exclusive). */
export function lastDayKey(booking: { ends_at: string }) {
  return dayKey(new Date(new Date(booking.ends_at).getTime() - 1));
}

export type WeekSegment = {
  booking: BookingWithMember;
  col: number; // 0-6
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  startsThisWeek: boolean;
};

/**
 * Lays bookings out as horizontal bars across a 7-day week. A checkout and a
 * check-in on the same day share a column, so they get separate lanes.
 */
export function layoutWeek(week: string[], bookings: BookingWithMember[]) {
  const first = week[0];
  const last = week[6];
  const segments: Omit<WeekSegment, "lane">[] = [];

  for (const booking of bookings) {
    const startKey = dayKey(booking.starts_at);
    const endKey = lastDayKey(booking);
    if (endKey < first || startKey > last) continue;
    const segStart = startKey < first ? first : startKey;
    const segEnd = endKey > last ? last : endKey;
    const col = week.indexOf(segStart);
    segments.push({
      booking,
      col,
      span: week.indexOf(segEnd) - col + 1,
      continuesBefore: startKey < first,
      continuesAfter: endKey > last,
      startsThisWeek: startKey >= first,
    });
  }

  segments.sort((a, b) => a.col - b.col || b.span - a.span);
  const laneEnds: number[] = [];
  const placed: WeekSegment[] = segments.map((s) => {
    let lane = laneEnds.findIndex((end) => end < s.col);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = s.col + s.span - 1;
    return { ...s, lane };
  });
  return placed;
}

/** Bookings touching a given day. */
export function bookingsOnDay(dayKeyStr: string, bookings: BookingWithMember[]) {
  return bookings.filter((b) => dayKey(b.starts_at) <= dayKeyStr && lastDayKey(b) >= dayKeyStr);
}

export type DayBlock = { booking: BookingWithMember; top: number; height: number; startsToday: boolean; endsToday: boolean };

/** Vertical blocks for the week view, positioned by Amsterdam wall-clock minutes. */
export function dayBlocks(dayKeyStr: string, bookings: BookingWithMember[]): DayBlock[] {
  const next = addDaysToKey(dayKeyStr, 1);
  return bookingsOnDay(dayKeyStr, bookings).map((booking) => {
    const s = inZone(booking.starts_at);
    const e = inZone(booking.ends_at);
    const startsToday = dayKey(booking.starts_at) === dayKeyStr;
    const endsToday = dayKey(booking.ends_at) === dayKeyStr || (dayKey(booking.ends_at) === next && e.getHours() === 0 && e.getMinutes() === 0);
    const startMin = startsToday ? s.getHours() * 60 + s.getMinutes() : 0;
    const endMin = dayKey(booking.ends_at) === dayKeyStr ? e.getHours() * 60 + e.getMinutes() : 1440;
    return { booking, top: startMin / 1440, height: Math.max(endMin - startMin, 20) / 1440, startsToday, endsToday };
  });
}
