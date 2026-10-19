"use client";

import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CalendarRange, Loader2, Moon, Sun, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/member-avatar";
import { createBooking, updateBooking } from "@/lib/actions/bookings";
import { validateBookingInput } from "@/lib/bookings/validation";
import { BOOKING_LIMITS } from "@/lib/constants";
import { addDaysToKey, dayKey, formatDuration, formatRange, fmt, nowInZone, utcToLocalParts } from "@/lib/time";
import type { BookingWithMember, ConflictInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Viewer } from "./booking-dialogs";

export type BookingPrefill = { startDate: string; startTime?: string; endDate?: string; endTime?: string };

type Fields = { title: string; notes: string; startDate: string; startTime: string; endDate: string; endTime: string };
type FieldName = keyof Fields;

const PRESETS = {
  overnight: { startTime: "15:00", endTime: "11:00", nights: 1 },
  day: { startTime: "10:00", endTime: "18:00", nights: 0 },
} as const;

const TITLE_IDEAS = ["Weekend stay", "Day visit", "Holiday", "Family dinner", "Maintenance"];

function initialFields(booking?: BookingWithMember, prefill?: BookingPrefill): Fields {
  if (booking) {
    const s = utcToLocalParts(booking.starts_at);
    const e = utcToLocalParts(booking.ends_at);
    return { title: booking.title, notes: booking.notes ?? "", startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time };
  }
  const now = nowInZone();
  const today = dayKey(now);
  // Default: an overnight stay from the chosen day (or today/tomorrow).
  const startDate = prefill?.startDate ?? (now.getHours() < 14 ? today : addDaysToKey(today, 1));
  const startTime = prefill?.startTime ?? PRESETS.overnight.startTime;
  return {
    title: "",
    notes: "",
    startDate,
    startTime,
    endDate: prefill?.endDate ?? addDaysToKey(startDate, 1),
    endTime: prefill?.endTime ?? PRESETS.overnight.endTime,
  };
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function BookingForm({
  viewer,
  booking,
  prefill,
  onDone,
  onBack,
}: {
  viewer: Viewer;
  booking?: BookingWithMember;
  prefill?: BookingPrefill;
  onDone: () => void;
  onBack?: () => void;
}) {
  const isEdit = Boolean(booking);
  const owner = booking?.member ?? viewer;
  const actingForOther = isEdit && booking!.user_id !== viewer.id;

  const [fields, setFields] = useState<Fields>(() => initialFields(booking, prefill));
  const [serverErrors, setServerErrors] = useState<Partial<Record<FieldName | "form", string>>>({});
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const startDateRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Live client-side check, using the same rules as the server.
  const check = validateBookingInput(fields, { requireFutureEnd: !(isEdit && viewer.role === "admin") });
  const clientErrors = check.ok ? {} : check.fieldErrors;
  const errors: Partial<Record<FieldName | "form", string>> = submitted ? { ...clientErrors, ...serverErrors } : serverErrors;
  const kind = fields.startDate && fields.endDate && daysBetween(fields.startDate, fields.endDate) >= 1 ? "overnight" : "day";

  function set<K extends FieldName>(key: K, value: string) {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      // Moving the start date keeps the stay's length.
      if (key === "startDate" && value && prev.startDate && prev.endDate) {
        next.endDate = addDaysToKey(value, Math.max(0, daysBetween(prev.startDate, prev.endDate)));
      }
      return next;
    });
    setServerErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
    if (key !== "title" && key !== "notes") setConflict(null);
  }

  function applyPreset(preset: keyof typeof PRESETS) {
    const p = PRESETS[preset];
    setFields((prev) => ({
      ...prev,
      startTime: p.startTime,
      endTime: p.endTime,
      endDate: addDaysToKey(prev.startDate, preset === "overnight" ? Math.max(1, daysBetween(prev.startDate, prev.endDate)) : 0),
    }));
    setConflict(null);
  }

  function startAfterConflict() {
    if (!conflict || !check.ok) return;
    const lengthMs = check.value.endsAt.getTime() - check.value.startsAt.getTime();
    const s = utcToLocalParts(conflict.endsAt);
    const e = utcToLocalParts(new Date(new Date(conflict.endsAt).getTime() + lengthMs));
    setFields((prev) => ({ ...prev, startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time }));
    setConflict(null);
    setServerErrors({});
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!check.ok || submitting.current) return;
    submitting.current = true;

    startTransition(async () => {
      try {
        const input = { ...fields };
        const result = booking
          ? await updateBooking(booking.id, booking.version, input)
          : await createBooking(input);

        if (result.ok) {
          toast.success(isEdit ? "Booking updated" : "Booking confirmed", {
            description: `${fields.title.trim()} · ${formatRange(check.value.startsAt, check.value.endsAt)}`,
          });
          onDone();
          return;
        }
        if (result.conflict || result.code === "BOOKING_CONFLICT") {
          setConflict(result.conflict ?? null);
          setServerErrors({ form: result.error });
          return;
        }
        if (result.code === "STALE" || result.code === "NOT_FOUND" || result.code === "BOOKING_ALREADY_CANCELLED") {
          toast.error(result.error);
          onDone();
          return;
        }
        setServerErrors({ ...(result.fieldErrors ?? {}), form: result.fieldErrors ? undefined : result.error });
      } catch {
        setServerErrors({ form: "Couldn't reach the server. Check your connection and try again." });
      } finally {
        submitting.current = false;
      }
    });
  }

  const errId = (name: string) => `${id}-${name}-error`;
  const fieldProps = (name: FieldName) => ({
    id: `${id}-${name}`,
    name,
    value: fields[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? errId(name) : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(name, e.target.value),
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <div className="border-b bg-paper px-5 pt-5 pb-4">
        <DialogTitle className="text-xl font-semibold">{isEdit ? "Edit booking" : "New booking"}</DialogTitle>
        <DialogDescription className="mt-2 flex items-center gap-2 text-sm">
          <MemberAvatar member={owner} size="xs" decorative />
          {actingForOther ? (
            <span>
              Editing <strong className="font-medium text-foreground">{owner.display_name}</strong>&rsquo;s booking as administrator
            </span>
          ) : (
            <span>
              Booking as <strong className="font-medium text-foreground">{owner.display_name}</strong>
            </span>
          )}
        </DialogDescription>
      </div>

      <div className="space-y-5 px-5 py-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input
            {...fieldProps("title")}
            placeholder="e.g. Weekend stay"
            maxLength={BOOKING_LIMITS.titleMax}
            autoComplete="off"
            autoFocus={!isEdit}
          />
          {errors.title ? (
            <FieldError id={errId("title")}>{errors.title}</FieldError>
          ) : (
            !isEdit && (
              <div className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Title suggestions">
                {TITLE_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => set("title", idea)}
                    className="rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Kind */}
        <fieldset>
          <legend className="sr-only">Type of booking</legend>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                ["overnight", "Overnight stay", Moon],
                ["day", "Day visit", Sun],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => applyPreset(value)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                  kind === value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Dates */}
        <div className="grid gap-4">
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">Start</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
              <Label htmlFor={`${id}-startDate`} className="sr-only">Start date</Label>
              <Input ref={startDateRef} type="date" required {...fieldProps("startDate")} />
              <Label htmlFor={`${id}-startTime`} className="sr-only">Start time</Label>
              <Input type="time" step={900} required {...fieldProps("startTime")} className="tabular" />
            </div>
            {(errors.startDate || errors.startTime) && (
              <FieldError id={errId(errors.startDate ? "startDate" : "startTime")}>{errors.startDate ?? errors.startTime}</FieldError>
            )}
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">End</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
              <Label htmlFor={`${id}-endDate`} className="sr-only">End date</Label>
              <Input type="date" required min={fields.startDate || undefined} {...fieldProps("endDate")} />
              <Label htmlFor={`${id}-endTime`} className="sr-only">End time</Label>
              <Input type="time" step={900} required {...fieldProps("endTime")} className="tabular" />
            </div>
            {(errors.endDate || errors.endTime) && (
              <FieldError id={errId(errors.endDate ? "endDate" : "endTime")}>{errors.endDate ?? errors.endTime}</FieldError>
            )}
          </fieldset>
        </div>

        {/* Summary */}
        <div
          aria-live="polite"
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm",
            check.ok ? "border-primary/20 bg-primary/5" : "border-dashed bg-muted/40 text-muted-foreground",
          )}
        >
          <CalendarRange className={cn("mt-0.5 size-4 shrink-0", check.ok ? "text-primary" : "")} aria-hidden />
          {check.ok ? (
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {fmt.dayShort(check.value.startsAt)} <span className="tabular">{fmt.time(check.value.startsAt)}</span>
                <ArrowRight className="mx-1.5 inline size-3.5 text-muted-foreground" aria-label="until" />
                {fmt.dayShort(check.value.endsAt)} <span className="tabular">{fmt.time(check.value.endsAt)}</span>
              </p>
              <p className="text-muted-foreground">{formatDuration(check.value.startsAt, check.value.endsAt)} · Europe/Amsterdam time</p>
            </div>
          ) : (
            <p>{Object.values(clientErrors)[0] ?? "Choose when you'll arrive and leave."}</p>
          )}
        </div>

        {/* Conflict */}
        {(conflict || errors.form) && (
          <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3.5 text-sm">
            <div className="flex gap-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-destructive">{errors.form ?? "That time is no longer available."}</p>
                {conflict && (
                  <p className="text-muted-foreground">
                    It overlaps <strong className="font-medium text-foreground">{conflict.title}</strong> by {conflict.memberName},{" "}
                    <span className="tabular">{formatRange(conflict.startsAt, conflict.endsAt)}</span>. Nothing was saved.
                  </p>
                )}
              </div>
            </div>
            {conflict && (
              <div className="mt-3 flex flex-wrap gap-2 pl-6.5">
                <Button type="button" size="sm" variant="outline" onClick={startAfterConflict}>
                  Start after it ({fmt.dayShort(conflict.endsAt)} {fmt.time(conflict.endsAt)})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConflict(null);
                    setServerErrors({});
                    startDateRef.current?.focus();
                  }}
                >
                  Choose other dates
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={`${id}-notes`}>
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            {fields.notes.length > BOOKING_LIMITS.notesMax * 0.8 && (
              <span className="text-xs text-muted-foreground tabular">
                {fields.notes.length}/{BOOKING_LIMITS.notesMax}
              </span>
            )}
          </div>
          <Textarea
            {...fieldProps("notes")}
            rows={3}
            maxLength={BOOKING_LIMITS.notesMax}
            placeholder="Anything the family should know: who's coming, bringing the dog, will light the stove…"
          />
          {errors.notes && <FieldError id={errId("notes")}>{errors.notes}</FieldError>}
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col-reverse gap-2 border-t bg-paper px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>
            <ArrowLeft aria-hidden /> Back
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending} aria-disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Saving…" : isEdit ? "Save changes" : "Confirm booking"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-[0.8rem] font-medium text-destructive">
      {children}
    </p>
  );
}
