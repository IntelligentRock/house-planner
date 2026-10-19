"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CalendarCheck2, CalendarClock, DoorOpen, House, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookingDialogs } from "@/components/bookings/booking-dialogs";
import { ColorDot, MemberAvatar } from "@/components/member-avatar";
import { EmptyState, Panel } from "@/components/page";
import { currentBooking, nextAvailability, nextBooking } from "@/lib/bookings/availability";
import { memberColor } from "@/lib/constants";
import { dayKey, fmt, formatDuration, relativeDay, utcToLocalParts } from "@/lib/time";
import type { BookingWithMember, MemberSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

function Tile({
  icon: Icon,
  label,
  tone = "default",
  children,
  action,
}: {
  icon: typeof House;
  label: string;
  tone?: "default" | "free" | "busy";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-md",
            tone === "free" && "bg-success-soft text-success",
            tone === "busy" && "bg-warning-soft text-warning",
            tone === "default" && "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
        {label}
      </div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

/** Status tiles. Everything is computed from the confirmed bookings in the database. */
export function SummaryTiles({ bookings, viewerId, nowIso }: { bookings: BookingWithMember[]; viewerId: string; nowIso: string }) {
  const { openNew, openBooking } = useBookingDialogs();
  const now = new Date(nowIso);
  const current = currentBooking(bookings, now);
  const next = nextBooking(bookings, now);
  const free = nextAvailability(bookings, now);
  const mine = bookings.find((b) => b.user_id === viewerId);
  const freeNow = free.from.getTime() <= now.getTime();

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile icon={House} label="Right now" tone={current ? "busy" : "free"}>
        {current ? (
          <button type="button" onClick={() => openBooking(current)} className="block w-full text-left">
            <p className="font-heading text-lg leading-snug font-semibold">Occupied</p>
            <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <MemberAvatar member={current.member} size="xs" decorative />
              <span className="truncate">
                {current.member?.display_name} until {fmt.dayShort(current.ends_at)} {fmt.time(current.ends_at)}
              </span>
            </p>
          </button>
        ) : (
          <>
            <p className="font-heading text-lg leading-snug font-semibold">The house is free</p>
            <p className="mt-1 text-muted-foreground">Nobody is staying right now.</p>
          </>
        )}
      </Tile>

      <Tile icon={CalendarClock} label="Next reservation">
        {next ? (
          <button type="button" onClick={() => openBooking(next)} className="block w-full text-left">
            <p className="truncate font-heading text-lg leading-snug font-semibold">{next.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <MemberAvatar member={next.member} size="xs" decorative />
              <span className="truncate">
                {next.member?.display_name}, {relativeDay(next.starts_at, now)} at {fmt.time(next.starts_at)}
              </span>
            </p>
          </button>
        ) : (
          <>
            <p className="font-heading text-lg leading-snug font-semibold">Nothing planned</p>
            <p className="mt-1 text-muted-foreground">No upcoming reservations.</p>
          </>
        )}
      </Tile>

      <Tile
        icon={DoorOpen}
        label="Next available"
        tone="free"
        action={
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              const p = utcToLocalParts(free.from);
              openNew(freeNow ? undefined : { startDate: p.date, startTime: p.time < "15:00" ? "15:00" : p.time });
            }}
          >
            <Plus aria-hidden /> Book it
          </Button>
        }
      >
        <p className="font-heading text-lg leading-snug font-semibold">
          {freeNow ? "Available now" : `${fmt.dayShort(free.from)}, ${fmt.time(free.from)}`}
        </p>
        <p className="mt-1 text-muted-foreground">
          {free.until
            ? `Free for ${formatDuration(free.from, free.until)}, until ${fmt.dayShort(free.until)}`
            : "No bookings after that"}
        </p>
      </Tile>

      <Tile
        icon={CalendarCheck2}
        label="Your next stay"
        action={
          !mine && (
            <Button size="xs" variant="outline" onClick={() => openNew()}>
              <Plus aria-hidden /> Plan a stay
            </Button>
          )
        }
      >
        {mine ? (
          <button type="button" onClick={() => openBooking(mine)} className="block w-full text-left">
            <p className="truncate font-heading text-lg leading-snug font-semibold">{mine.title}</p>
            <p className="mt-1 text-muted-foreground">
              {new Date(mine.starts_at) <= now ? "Happening now" : relativeDay(mine.starts_at, now)} ·{" "}
              {formatDuration(mine.starts_at, mine.ends_at)}
            </p>
          </button>
        ) : (
          <>
            <p className="font-heading text-lg leading-snug font-semibold">None planned</p>
            <p className="mt-1 text-muted-foreground">You have no upcoming bookings.</p>
          </>
        )}
      </Tile>
    </div>
  );
}

export function UpcomingPanel({ bookings, total }: { bookings: BookingWithMember[]; total: number }) {
  const { openBooking, openNew } = useBookingDialogs();
  return (
    <Panel
      title="Upcoming"
      description={total ? `${total} upcoming ${total === 1 ? "booking" : "bookings"}` : undefined}
      actions={
        total > 0 && (
          <Button variant="ghost" size="sm" render={<Link href="/bookings" />} nativeButton={false}>
            View all <ArrowRight aria-hidden />
          </Button>
        )
      }
      bodyClassName="px-3 py-3 sm:px-3"
    >
      {bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="No upcoming bookings"
          action={
            <Button size="sm" onClick={() => openNew()}>
              <Plus aria-hidden /> New booking
            </Button>
          }
          className="py-6"
        >
          The calendar is wide open.
        </EmptyState>
      ) : (
        <ol className="space-y-1">
          {bookings.map((b) => (
            <li key={b.id}>
              <UpcomingItem booking={b} onOpen={() => openBooking(b)} />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function UpcomingItem({ booking: b, onOpen }: { booking: BookingWithMember; onOpen: () => void }) {
  const color = memberColor(b.member?.color ?? "slate");
  const start = dayKey(b.starts_at);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="flex w-11 shrink-0 flex-col items-center rounded-md border py-1 leading-none"
        style={{ borderColor: color.solid + "55", backgroundColor: color.soft, color: color.ink }}
      >
        <span className="text-[0.65rem] font-semibold uppercase">{fmt.dayShort(b.starts_at).split(" ")[2]}</span>
        <span className="font-heading text-lg font-semibold tabular">{Number(start.slice(8))}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{b.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MemberAvatar member={b.member} size="xs" decorative />
          <span className="truncate">
            {b.member?.display_name} · {formatDuration(b.starts_at, b.ends_at)}
          </span>
        </span>
      </span>
    </button>
  );
}

export function MemberLegend({ members, viewerId }: { members: MemberSummary[]; viewerId: string }) {
  return (
    <Panel title="Who's who" bodyClassName="space-y-4">
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5 text-sm">
            <ColorDot color={m.color} className="size-3" />
            <MemberAvatar member={m} size="xs" decorative />
            <span className="truncate">
              {m.display_name}
              {m.id === viewerId && <span className="text-muted-foreground"> (you)</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <span className="size-4 rounded-full bg-highlight" aria-hidden />
          Today
        </p>
        <p className="flex items-center gap-2">
          <span className="size-4 rounded-sm border bg-hatch" aria-hidden />
          Past days
        </p>
        <p>Each booking shows its member&rsquo;s avatar and name as well as their colour.</p>
      </div>
    </Panel>
  );
}

export function WelcomeToast({ name }: { name: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.success(`Welcome, ${name}!`, { description: "You're all set. Pick a date on the calendar to make your first booking." });
    router.replace(pathname, { scroll: false });
  }, [name, pathname, router]);
  return null;
}
