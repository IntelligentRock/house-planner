import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfMonth, startOfWeek, endOfMonth, endOfWeek } from "date-fns";
import { enGB } from "date-fns/locale";

/** Every date the app shows or accepts is interpreted in this zone. */
export const TIME_ZONE = "Europe/Amsterdam";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A Date viewed in Amsterdam time: getHours(), getDate(), etc. are local. */
export function inZone(date: Date | number | string) {
  return new TZDate(new Date(date).getTime(), TIME_ZONE);
}

export function nowInZone() {
  return TZDate.tz(TIME_ZONE);
}

export type LocalToUtcResult =
  | { ok: true; date: Date }
  | { ok: false; reason: "invalid" | "nonexistent" };

/**
 * Converts an Amsterdam wall-clock date ("2026-03-29") and time ("02:30") to
 * an absolute instant.
 *
 * - Times skipped by the spring-forward change (02:00–02:59 on the last Sunday
 *   of March) do not exist and are rejected rather than silently shifted.
 * - Times repeated by the autumn change resolve to the first occurrence (CEST).
 */
export function localToUtc(dateStr: string, timeStr: string): LocalToUtcResult {
  const d = DATE_RE.exec(dateStr);
  const t = TIME_RE.exec(timeStr);
  if (!d || !t) return { ok: false, reason: "invalid" };

  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hour, minute] = [Number(t[1]), Number(t[2])];

  // The wall clock read as if it were UTC; reject dates like 31 February.
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return { ok: false, reason: "invalid" };
  }

  // Try every UTC offset the zone uses around that date, and keep the instants
  // whose Amsterdam wall clock matches the input. Mapping an instant to a zone
  // is unambiguous, so this never depends on the host machine's timezone.
  const offsets = new Set(
    [-86_400_000, 0, 86_400_000].map((delta) => new TZDate(naive + delta, TIME_ZONE).getTimezoneOffset()),
  );
  const matches = [...offsets]
    .map((offset) => naive + offset * 60_000)
    .filter((ts) => {
      const z = new TZDate(ts, TIME_ZONE);
      return z.getDate() === day && z.getHours() === hour && z.getMinutes() === minute;
    })
    .sort((a, b) => a - b);

  if (matches.length === 0) return { ok: false, reason: "nonexistent" };
  return { ok: true, date: new Date(matches[0]) };
}

/** "yyyy-MM-dd" and "HH:mm" parts of an instant in Amsterdam time. */
export function utcToLocalParts(date: Date | string) {
  const z = inZone(date);
  return { date: format(z, "yyyy-MM-dd"), time: format(z, "HH:mm") };
}

/** Day key ("yyyy-MM-dd") of an instant in Amsterdam time. */
export function dayKey(date: Date | string | number) {
  return format(inZone(date), "yyyy-MM-dd");
}

/** Start of an Amsterdam calendar day as an absolute instant. */
export function startOfLocalDay(dayKeyStr: string) {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, 0, TIME_ZONE).getTime());
}

/**
 * A day key as a date in a fixed UTC zone. Date arithmetic on day keys must
 * not use the host timezone, or results shift on servers/browsers elsewhere.
 */
function keyToDate(dayKeyStr: string) {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  return new TZDate(Date.UTC(y, m - 1, d), "UTC");
}

export function addDaysToKey(dayKeyStr: string, amount: number) {
  return format(addDays(keyToDate(dayKeyStr), amount), "yyyy-MM-dd");
}

// --- Formatting (English UI, Dutch conventions: day-month order, 24h clock, weeks start Monday)

const opts = { locale: enGB };

export const fmt = {
  /** 14:30 */
  time: (d: Date | string) => format(inZone(d), "HH:mm", opts),
  /** Sat 17 Oct */
  dayShort: (d: Date | string) => format(inZone(d), "EEE d MMM", opts),
  /** Saturday 17 October 2026 */
  dayLong: (d: Date | string) => format(inZone(d), "EEEE d MMMM yyyy", opts),
  /** 17 Oct 2026 */
  date: (d: Date | string) => format(inZone(d), "d MMM yyyy", opts),
  /** 17-10-2026 */
  dateNumeric: (d: Date | string) => format(inZone(d), "dd-MM-yyyy", opts),
  /** Sat 17 Oct, 14:30 */
  dateTime: (d: Date | string) => format(inZone(d), "EEE d MMM, HH:mm", opts),
  /** October 2026 */
  month: (d: Date | string) => format(inZone(d), "MMMM yyyy", opts),
};

/** "Fri 16 Oct 15:00 – Sun 18 Oct 11:00" or "Sat 17 Oct, 10:00 – 16:00". */
export function formatRange(start: Date | string, end: Date | string) {
  if (dayKey(start) === dayKey(end)) {
    return `${fmt.dateTime(start)} – ${fmt.time(end)}`;
  }
  return `${fmt.dayShort(start)} ${fmt.time(start)} – ${fmt.dayShort(end)} ${fmt.time(end)}`;
}

/** Human duration: "45 min", "3 h 30 min", "2 nights", "1 night + 4 h"-style kept simple. */
export function formatDuration(start: Date | string, end: Date | string) {
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const nights = nightsBetween(start, end);
  if (nights >= 1) return nights === 1 ? "1 night" : `${nights} nights`;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Number of local midnights crossed. */
export function nightsBetween(start: Date | string, end: Date | string) {
  const a = startOfLocalDay(dayKey(start));
  const b = startOfLocalDay(dayKey(end));
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Relative day phrase: "today", "tomorrow", "in 5 days", or a date. */
export function relativeDay(target: Date | string, now: Date = new Date()) {
  const diff = nightsBetween(now, target);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1 && diff < 7) return `in ${diff} days`;
  return `on ${fmt.dayShort(target)}`;
}

// --- Calendar grid helpers (all day keys are Amsterdam-local)

export function monthKeyOf(date: Date | string) {
  return format(inZone(date), "yyyy-MM");
}

export function parseMonthKey(key: string | undefined, fallback: Date = new Date()) {
  if (key && /^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return key;
  return monthKeyOf(fallback);
}

export function parseDayKey(key: string | undefined, fallback: Date = new Date()) {
  if (key && DATE_RE.test(key) && localToUtc(key, "12:00").ok) return key;
  return dayKey(fallback);
}

/** Monday-start weeks covering the month: 4–6 rows of 7 day keys. */
export function monthGrid(monthKey: string) {
  const first = keyToDate(`${monthKey}-01`);
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const weeks: string[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(format(cursor, "yyyy-MM-dd"));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Monday of the week containing the day key. */
export function weekStartKey(dayKeyStr: string) {
  return format(startOfWeek(keyToDate(dayKeyStr), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Labels for a day key, computed without timezone drift. */
export function dayKeyLabel(dayKeyStr: string, pattern: string) {
  return format(keyToDate(dayKeyStr), pattern, opts);
}
