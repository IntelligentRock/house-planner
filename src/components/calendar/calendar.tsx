"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, List, Loader2, Plus, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookingDialogs } from "@/components/bookings/booking-dialogs";
import { MemberAvatar } from "@/components/member-avatar";
import { useIsDesktop } from "@/hooks/use-media-query";
import { memberColor } from "@/lib/constants";
import {
  addDaysToKey,
  dayKey,
  dayKeyLabel,
  fmt,
  formatDuration,
  formatRange,
  monthGrid,
  shiftMonthKey,
  weekStartKey,
} from "@/lib/time";
import type { BookingWithMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { bookingsOnDay, dayBlocks, layoutWeek } from "./layout";

export type CalendarView = "month" | "week" | "agenda";

type Props = {
  view: CalendarView;
  anchor: string; // day key
  todayKey: string;
  nowIso: string;
  bookings: BookingWithMember[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_LANES = 3;

export function Calendar({ view, anchor, todayKey, nowIso, bookings }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const { openNew } = useBookingDialogs();
  const isDesktop = useIsDesktop();

  function go(nextView: CalendarView, date: string) {
    startTransition(() => router.push(`${pathname}?view=${nextView}&date=${date}`, { scroll: false }));
  }

  const monthKey = anchor.slice(0, 7);
  const weekStart = weekStartKey(anchor);

  const nav = {
    month: { prev: `${shiftMonthKey(monthKey, -1)}-01`, next: `${shiftMonthKey(monthKey, 1)}-01` },
    week: { prev: addDaysToKey(weekStart, -7), next: addDaysToKey(weekStart, 7) },
    agenda: { prev: `${shiftMonthKey(monthKey, -1)}-01`, next: `${shiftMonthKey(monthKey, 1)}-01` },
  }[view];

  const title =
    view === "week"
      ? weekTitle(weekStart)
      : dayKeyLabel(`${monthKey}-01`, "MMMM yyyy");

  const isCurrent =
    view === "week" ? weekStart === weekStartKey(todayKey) : monthKey === todayKey.slice(0, 7);

  return (
    <div className="flex min-w-0 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => go(view, nav.prev)} aria-label={`Previous ${view === "week" ? "week" : "month"}`}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => go(view, nav.next)} aria-label={`Next ${view === "week" ? "week" : "month"}`}>
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => go(view, todayKey)} disabled={isCurrent} className="ml-0.5">
            Today
          </Button>
        </div>
        <h2 className="flex min-w-0 items-center gap-2 font-heading text-lg font-semibold" aria-live="polite">
          <span className="truncate">{title}</span>
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label="Calendar view" className="flex rounded-lg bg-muted p-0.5">
            {(
              [
                ["month", "Month", CalendarDays],
                ["week", "Week", Rows3],
                ["agenda", "Agenda", List],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => go(v, view === "week" && v !== "week" ? weekStart : anchor)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[0.8rem] font-medium transition-colors",
                  view === v ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="max-sm:sr-only">{label}</span>
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openNew()} className="hidden md:inline-flex">
            <Plus aria-hidden /> New booking
          </Button>
        </div>
      </div>

      <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {view === "month" && (
          <MonthView monthKey={monthKey} todayKey={todayKey} nowIso={nowIso} bookings={bookings} isDesktop={isDesktop} onDrill={(d) => go("week", d)} />
        )}
        {view === "week" &&
          (isDesktop ? (
            <WeekView weekStart={weekStart} todayKey={todayKey} nowIso={nowIso} bookings={bookings} />
          ) : (
            <Agenda
              from={weekStart}
              to={addDaysToKey(weekStart, 7)}
              todayKey={todayKey}
              nowIso={nowIso}
              bookings={bookings}
              emptyText="Nothing booked this week."
            />
          ))}
        {view === "agenda" && (
          <Agenda
            from={`${monthKey}-01`}
            to={`${shiftMonthKey(monthKey, 1)}-01`}
            todayKey={todayKey}
            nowIso={nowIso}
            bookings={bookings}
            emptyText={`Nothing booked in ${dayKeyLabel(`${monthKey}-01`, "MMMM")} yet.`}
          />
        )}
      </div>
    </div>
  );
}

function weekTitle(weekStart: string) {
  const end = addDaysToKey(weekStart, 6);
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${dayKeyLabel(weekStart, "d")} – ${dayKeyLabel(end, "d MMM yyyy")}`
    : `${dayKeyLabel(weekStart, "d MMM")} – ${dayKeyLabel(end, "d MMM yyyy")}`;
}

function bookingLabel(b: BookingWithMember) {
  return `${b.title}, booked by ${b.member?.display_name ?? "a former member"}, ${formatRange(b.starts_at, b.ends_at)}`;
}

/* -------------------------------------------------------------------------- */
/* Month                                                                       */
/* -------------------------------------------------------------------------- */

function MonthView({
  monthKey,
  todayKey,
  nowIso,
  bookings,
  isDesktop,
  onDrill,
}: {
  monthKey: string;
  todayKey: string;
  nowIso: string;
  bookings: BookingWithMember[];
  isDesktop: boolean;
  onDrill: (day: string) => void;
}) {
  const { openNew, openBooking } = useBookingDialogs();
  const weeks = useMemo(() => monthGrid(monthKey), [monthKey]);
  const defaultSelected = todayKey.startsWith(monthKey) ? todayKey : `${monthKey}-01`;
  const [selected, setSelected] = useState(defaultSelected);
  const selectedDay = selected.startsWith(monthKey) ? selected : defaultSelected;

  function onDay(day: string) {
    if (isDesktop) openNew({ startDate: day });
    else setSelected(day);
  }

  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-paper text-center text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn("py-2", i >= 5 && "text-foreground/70")}>
            <span aria-hidden className="md:hidden">{d.slice(0, 2)}</span>
            <span className="max-md:sr-only">{d}</span>
          </div>
        ))}
      </div>

      <div>
        {weeks.map((week) => {
          const segments = layoutWeek(week, bookings);
          const visible = segments.filter((s) => s.lane < MAX_LANES);
          const lanes = Math.min(MAX_LANES, Math.max(1, ...segments.map((s) => s.lane + 1)));
          return (
            <div
              key={week[0]}
              className="relative grid grid-cols-7 border-b last:border-b-0"
              style={{ gridTemplateRows: `auto repeat(${lanes}, auto) 1fr` }}
            >
              {week.map((day, i) => {
                const inMonth = day.startsWith(monthKey);
                const isPast = day < todayKey;
                const isToday = day === todayKey;
                const hidden = segments.filter((s) => s.lane >= MAX_LANES && s.col <= i && i < s.col + s.span).length;
                const occupied = segments.some((s) => s.col <= i && i < s.col + s.span);
                return (
                  <div
                    key={day}
                    className={cn(
                      "relative min-h-14 border-r last:border-r-0 md:min-h-[7.25rem]",
                      !inMonth && "bg-muted/45",
                      isPast && "bg-hatch",
                      !isDesktop && selectedDay === day && "bg-primary/[0.07]",
                    )}
                    style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
                  >
                    <button
                      type="button"
                      onClick={() => onDay(day)}
                      disabled={isPast && isDesktop}
                      aria-pressed={!isDesktop ? selectedDay === day : undefined}
                      aria-label={
                        isDesktop
                          ? `${dayKeyLabel(day, "EEEE d MMMM")}${isPast ? " (past)" : occupied ? ", partly booked. New booking" : ", free. New booking"}`
                          : `${dayKeyLabel(day, "EEEE d MMMM")}${occupied ? ", booked" : ""}`
                      }
                      className={cn(
                        "group absolute inset-0 flex items-start justify-end p-1.5 text-left outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        isDesktop && !isPast && "hover:bg-primary/[0.04]",
                        isDesktop && isPast && "cursor-default",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-[0.8rem] tabular md:size-7",
                          isToday && "bg-highlight font-semibold text-highlight-foreground",
                          !isToday && (!inMonth || isPast) && "text-muted-foreground/70",
                          !isToday && inMonth && !isPast && "font-medium",
                        )}
                      >
                        {Number(day.slice(8))}
                      </span>
                      {isDesktop && !isPast && (
                        <Plus
                          aria-hidden
                          className="absolute bottom-1.5 left-1.5 size-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        />
                      )}
                    </button>
                    {hidden > 0 && isDesktop && (
                      <button
                        type="button"
                        onClick={() => onDrill(day)}
                        className="absolute bottom-1 left-1.5 z-10 text-[0.7rem] font-medium text-muted-foreground hover:text-foreground"
                      >
                        +{hidden} more
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Spacer row for the day numbers */}
              <div aria-hidden className="pointer-events-none h-8 md:h-9" style={{ gridColumn: "1 / -1", gridRow: 1 }} />

              {visible.map((s) => (
                <MonthBar
                  key={`${s.booking.id}-${week[0]}`}
                  segment={s}
                  isPast={new Date(s.booking.ends_at) <= new Date(nowIso)}
                  onOpen={() => openBooking(s.booking)}
                />
              ))}
              <div aria-hidden className="pointer-events-none h-1.5 md:h-4" style={{ gridColumn: "1 / -1", gridRow: lanes + 2 }} />
            </div>
          );
        })}
      </div>

      {!isDesktop && (
        <SelectedDay day={selectedDay} todayKey={todayKey} bookings={bookingsOnDay(selectedDay, bookings)} />
      )}
    </div>
  );
}

function MonthBar({
  segment: s,
  isPast,
  onOpen,
}: {
  segment: ReturnType<typeof layoutWeek>[number];
  isPast: boolean;
  onOpen: () => void;
}) {
  const color = memberColor(s.booking.member?.color ?? "slate");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={bookingLabel(s.booking)}
      title={bookingLabel(s.booking)}
      className={cn(
        "relative z-10 my-px flex h-1.5 min-w-0 items-center gap-1.5 overflow-hidden text-left text-[0.75rem] leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-[1.375rem] md:px-1.5",
        "transition-[filter] hover:brightness-[0.97]",
        s.continuesBefore ? "ml-0 rounded-l-none" : "ml-1 rounded-l-[5px] md:border-l-[3px]",
        s.continuesAfter ? "mr-0 rounded-r-none" : "mr-1 rounded-r-[5px]",
        isPast && "opacity-60",
      )}
      style={{
        gridColumn: `${s.col + 1} / span ${s.span}`,
        gridRow: s.lane + 2,
        backgroundColor: color.soft,
        borderLeftColor: color.solid,
        color: color.ink,
      }}
    >
      {/* Phones show a thin solid line instead of a labelled bar. */}
      <span aria-hidden className="absolute inset-0 md:hidden" style={{ backgroundColor: color.solid }} />
      <span className="hidden min-w-0 items-center gap-1.5 md:flex">
        {(s.startsThisWeek || s.continuesBefore) && <MemberAvatar member={s.booking.member} size="xs" decorative className="ring-0 ring-offset-0" />}
        {s.startsThisWeek && <span className="shrink-0 font-semibold tabular">{fmt.time(s.booking.starts_at)}</span>}
        <span className="truncate font-medium">{s.booking.title}</span>
        {s.span > 1 && <span className="truncate opacity-75">· {s.booking.member?.display_name}</span>}
      </span>
    </button>
  );
}

function SelectedDay({ day, todayKey, bookings }: { day: string; todayKey: string; bookings: BookingWithMember[] }) {
  const { openNew, openBooking } = useBookingDialogs();
  const isPast = day < todayKey;
  return (
    <div className="border-t bg-paper px-3 py-3" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-heading font-semibold">{dayKeyLabel(day, "EEEE d MMMM")}</p>
        {!isPast && (
          <Button size="sm" variant="outline" onClick={() => openNew({ startDate: day })}>
            <Plus aria-hidden /> Book this day
          </Button>
        )}
      </div>
      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{isPast ? "Nothing was booked." : "The house is free all day."}</p>
      ) : (
        <ul className="space-y-1.5">
          {bookings.map((b) => (
            <li key={b.id}>
              <BookingRow booking={b} onOpen={() => openBooking(b)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Week                                                                        */
/* -------------------------------------------------------------------------- */

const HOUR_PX = 44;

function WeekView({
  weekStart,
  todayKey,
  nowIso,
  bookings,
}: {
  weekStart: string;
  todayKey: string;
  nowIso: string;
  bookings: BookingWithMember[];
}) {
  const { openNew, openBooking } = useBookingDialogs();
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const scroller = useRef<HTMLDivElement>(null);
  const now = new Date(nowIso);
  const nowZoned = fmt.time(now).split(":").map(Number);
  const nowFrac = (nowZoned[0] * 60 + nowZoned[1]) / 1440;

  useEffect(() => {
    scroller.current?.scrollTo({ top: HOUR_PX * 7.5 });
  }, [weekStart]);

  function slotClick(day: string, e: React.MouseEvent<HTMLDivElement>) {
    if (day < todayKey) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hour = Math.min(22, Math.max(0, Math.floor((e.clientY - rect.top) / HOUR_PX)));
    const pad = (n: number) => String(n).padStart(2, "0");
    openNew({ startDate: day, startTime: `${pad(hour)}:00`, endDate: day, endTime: `${pad(hour + 2)}:00` });
  }

  return (
    <div>
      <div className="grid grid-cols-[3.25rem_repeat(7,1fr)] border-b bg-paper">
        <div />
        {days.map((day) => {
          const isToday = day === todayKey;
          const isPast = day < todayKey;
          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => openNew({ startDate: day })}
              aria-label={`${dayKeyLabel(day, "EEEE d MMMM")}${isPast ? " (past)" : ". New booking"}`}
              className="flex flex-col items-center gap-0.5 border-l py-2 text-center hover:bg-primary/[0.04] disabled:hover:bg-transparent"
            >
              <span className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{dayKeyLabel(day, "EEE")}</span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm tabular",
                  isToday ? "bg-highlight font-semibold text-highlight-foreground" : isPast ? "text-muted-foreground" : "font-medium",
                )}
              >
                {Number(day.slice(8))}
              </span>
            </button>
          );
        })}
      </div>
      <div ref={scroller} className="max-h-[34rem] overflow-y-auto overscroll-contain">
        <div className="relative grid grid-cols-[3.25rem_repeat(7,1fr)]" style={{ height: HOUR_PX * 24 }}>
          <div className="relative">
            {Array.from({ length: 23 }, (_, h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[0.7rem] text-muted-foreground tabular"
                style={{ top: (h + 1) * HOUR_PX }}
              >
                {String(h + 1).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((day) => {
            const isPast = day < todayKey;
            return (
              <div
                key={day}
                className={cn("relative border-l", isPast ? "bg-hatch" : "cursor-copy")}
                onClick={(e) => slotClick(day, e)}
                style={{
                  backgroundImage: `${isPast ? "repeating-linear-gradient(135deg, rgb(110 95 70 / 0.07) 0 1px, transparent 1px 7px), " : ""}repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px ${HOUR_PX}px)`,
                }}
              >
                {dayBlocks(day, bookings).map(({ booking, top, height, startsToday, endsToday }) => {
                  const color = memberColor(booking.member?.color ?? "slate");
                  const tall = height * 24 * HOUR_PX > 44;
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openBooking(booking);
                      }}
                      aria-label={bookingLabel(booking)}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden border-l-[3px] px-1.5 py-1 text-left text-[0.75rem] leading-tight shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        startsToday ? "rounded-t-md" : "rounded-t-none",
                        endsToday ? "rounded-b-md" : "rounded-b-none",
                        new Date(booking.ends_at) <= now && "opacity-60",
                      )}
                      style={{
                        top: `${top * 100}%`,
                        height: `${height * 100}%`,
                        backgroundColor: color.soft,
                        borderLeftColor: color.solid,
                        color: color.ink,
                      }}
                    >
                      <span className="flex items-center gap-1 font-semibold">
                        <MemberAvatar member={booking.member} size="xs" decorative className="ring-0 ring-offset-0" />
                        <span className="truncate">{booking.title}</span>
                      </span>
                      {tall && (
                        <span className="mt-0.5 block truncate opacity-80 tabular">
                          {startsToday ? fmt.time(booking.starts_at) : "…"}–{endsToday ? fmt.time(booking.ends_at) : "…"} · {booking.member?.display_name}
                        </span>
                      )}
                    </button>
                  );
                })}
                {day === todayKey && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: `${nowFrac * 100}%` }}>
                    <span className="-ml-1 size-2 rounded-full bg-highlight" />
                    <span className="h-px flex-1 bg-highlight" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Agenda                                                                      */
/* -------------------------------------------------------------------------- */

function Agenda({
  from,
  to,
  todayKey,
  nowIso,
  bookings,
  emptyText,
}: {
  from: string;
  to: string;
  todayKey: string;
  nowIso: string;
  bookings: BookingWithMember[];
  emptyText: string;
}) {
  const { openNew, openBooking } = useBookingDialogs();
  const sorted = [...bookings].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const startDay = from < todayKey && todayKey < to ? todayKey : from;

  if (sorted.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="font-heading text-lg font-semibold">{emptyText}</p>
        <p className="mt-1 text-sm text-muted-foreground">The house is free for the whole period.</p>
        {to > todayKey && (
          <Button className="mt-4" onClick={() => openNew({ startDate: from > todayKey ? from : todayKey })}>
            <Plus aria-hidden /> New booking
          </Button>
        )}
      </div>
    );
  }

  const groups = new Map<string, BookingWithMember[]>();
  for (const b of sorted) {
    const key = dayKey(b.starts_at) < from ? from : dayKey(b.starts_at);
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  const items: React.ReactNode[] = [];
  let cursorEnd: string | null = null;
  for (const [day, list] of groups) {
    const gapStart = cursorEnd ?? `${startDay}T00:00`;
    const firstStart = list[0].starts_at;
    if (cursorEnd && new Date(firstStart).getTime() - new Date(cursorEnd).getTime() >= 3_600_000 && new Date(firstStart) > new Date(nowIso)) {
      items.push(
        <li key={`gap-${day}`} className="flex items-center gap-3 px-4 py-1.5 text-xs text-success sm:px-5">
          <span className="h-px w-4 bg-success/40" />
          Free for {formatDuration(gapStart, firstStart)}
          <span className="h-px flex-1 bg-success/20" />
        </li>,
      );
    }
    items.push(
      <li key={day} className="grid gap-2 px-4 py-3 sm:grid-cols-[7.5rem_1fr] sm:px-5">
        <div className={cn("text-sm", day === todayKey ? "font-semibold text-highlight" : "text-muted-foreground")}>
          <span className="font-heading text-base font-semibold text-foreground">{dayKeyLabel(day, "EEE d")}</span>{" "}
          {dayKeyLabel(day, "MMM")}
          {day === todayKey && <span className="ml-1.5 text-xs">Today</span>}
        </div>
        <ul className="space-y-1.5">
          {list.map((b) => (
            <li key={b.id}>
              <BookingRow booking={b} onOpen={() => openBooking(b)} />
            </li>
          ))}
        </ul>
      </li>,
    );
    cursorEnd = list.reduce((max, b) => (b.ends_at > max ? b.ends_at : max), list[0].ends_at);
  }

  return <ol className="divide-y divide-border/70 py-1">{items}</ol>;
}

/** One booking as a list row: colour edge, avatar, title, owner and times. */
export function BookingRow({ booking: b, onOpen, showDate = false }: { booking: BookingWithMember; onOpen: () => void; showDate?: boolean }) {
  const color = memberColor(b.member?.color ?? "slate");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-lg border bg-card py-2 pr-3 pl-0 text-left shadow-card transition-colors outline-none hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden className="h-9 w-1 shrink-0 rounded-r-full" style={{ backgroundColor: color.solid }} />
      <MemberAvatar member={b.member} size="sm" decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{b.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {b.member?.display_name ?? "Former member"} ·{" "}
          <span className="tabular">{showDate ? formatRange(b.starts_at, b.ends_at) : `${fmt.dayShort(b.starts_at)} ${fmt.time(b.starts_at)} – ${fmt.dayShort(b.ends_at)} ${fmt.time(b.ends_at)}`}</span>
        </span>
      </span>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{formatDuration(b.starts_at, b.ends_at)}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}
