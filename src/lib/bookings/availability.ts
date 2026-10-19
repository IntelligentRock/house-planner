type Interval = { starts_at: string; ends_at: string };

const t = (iso: string) => new Date(iso).getTime();

/** Half-open [start, end) overlap: touching intervals do not overlap. */
export function overlaps(a: Interval, b: Interval) {
  return t(a.starts_at) < t(b.ends_at) && t(b.starts_at) < t(a.ends_at);
}

/** Confirmed bookings sorted by start. */
function sorted<T extends Interval>(bookings: T[]) {
  return [...bookings].sort((a, b) => t(a.starts_at) - t(b.starts_at));
}

/** The booking occupying the house at `now`, if any. */
export function currentBooking<T extends Interval>(bookings: T[], now: Date = new Date()) {
  const n = now.getTime();
  return bookings.find((b) => t(b.starts_at) <= n && n < t(b.ends_at)) ?? null;
}

/** The next booking that starts after `now`. */
export function nextBooking<T extends Interval>(bookings: T[], now: Date = new Date()) {
  const n = now.getTime();
  return sorted(bookings).find((b) => t(b.starts_at) > n) ?? null;
}

/**
 * The first moment at or after `now` when the house is free, plus how long it
 * stays free (`until` is null when nothing else is booked). Back-to-back
 * bookings are chained, so a 11:00 checkout followed by an 11:00 check-in
 * does not count as availability.
 */
export function nextAvailability<T extends Interval>(bookings: T[], now: Date = new Date()) {
  let freeFrom = now.getTime();
  for (const b of sorted(bookings)) {
    if (t(b.ends_at) <= freeFrom) continue;
    if (t(b.starts_at) <= freeFrom) {
      freeFrom = t(b.ends_at);
      continue;
    }
    return { from: new Date(freeFrom), until: new Date(t(b.starts_at)) };
  }
  return { from: new Date(freeFrom), until: null };
}
