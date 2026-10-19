import { z } from "zod";
import { BOOKING_LIMITS } from "@/lib/constants";
import { localToUtc } from "@/lib/time";

export const bookingInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the booking a short title.")
    .max(BOOKING_LIMITS.titleMax, `Keep the title under ${BOOKING_LIMITS.titleMax} characters.`),
  notes: z
    .string()
    .trim()
    .max(BOOKING_LIMITS.notesMax, `Notes can be at most ${BOOKING_LIMITS.notesMax} characters.`)
    .optional()
    .transform((v) => (v ? v : null)),
  startDate: z.string().min(1, "Pick a start date."),
  startTime: z.string().min(1, "Pick a start time."),
  endDate: z.string().min(1, "Pick an end date."),
  endTime: z.string().min(1, "Pick an end time."),
});

export type BookingInput = z.input<typeof bookingInputSchema>;

export type ValidBooking = {
  title: string;
  notes: string | null;
  startsAt: Date;
  endsAt: Date;
};

export type BookingValidation =
  | { ok: true; value: ValidBooking }
  | { ok: false; fieldErrors: Record<string, string> };

const NONEXISTENT =
  "This time doesn't exist in the Netherlands: clocks jump from 02:00 to 03:00 that night.";

/**
 * Validates booking form input. Dates and times are Amsterdam wall-clock
 * values; the result holds absolute instants. `now` is injectable for tests.
 */
export function validateBookingInput(
  input: unknown,
  { now = new Date(), requireFutureEnd = true }: { now?: Date; requireFutureEnd?: boolean } = {},
): BookingValidation {
  const parsed = bookingInputSchema.safeParse(input);
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const { title, notes, startDate, startTime, endDate, endTime } = parsed.data;
  const start = localToUtc(startDate, startTime);
  const end = localToUtc(endDate, endTime);

  if (!start.ok) {
    fieldErrors.startTime = start.reason === "nonexistent" ? NONEXISTENT : "Enter a valid start date and time.";
  }
  if (!end.ok) {
    fieldErrors.endTime = end.reason === "nonexistent" ? NONEXISTENT : "Enter a valid end date and time.";
  }
  if (!start.ok || !end.ok) return { ok: false, fieldErrors };

  const startsAt = start.date;
  const endsAt = end.date;
  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60000;

  if (minutes <= 0) {
    fieldErrors.endTime = "The end must be after the start.";
  } else if (minutes < BOOKING_LIMITS.minMinutes) {
    fieldErrors.endTime = `A booking must last at least ${BOOKING_LIMITS.minMinutes} minutes.`;
  } else if (minutes > BOOKING_LIMITS.maxDays * 24 * 60) {
    fieldErrors.endTime = `A single booking can last at most ${BOOKING_LIMITS.maxDays} days.`;
  } else if (requireFutureEnd && endsAt <= now) {
    fieldErrors.endTime = "This booking would already be over. Pick a time in the future.";
  }

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, value: { title, notes, startsAt, endsAt } };
}
