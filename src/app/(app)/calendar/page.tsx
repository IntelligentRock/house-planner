import { Suspense } from "react";
import type { Metadata } from "next";
import { Calendar, type CalendarView } from "@/components/calendar/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/page";
import { requireMember } from "@/lib/auth";
import { getActiveMembers, getBookingsInRange, getUpcomingBookings } from "@/lib/data";
import {
  addDaysToKey,
  dayKey,
  dayKeyLabel,
  monthGrid,
  nowInZone,
  parseDayKey,
  shiftMonthKey,
  startOfLocalDay,
  weekStartKey,
} from "@/lib/time";
import { MemberLegend, SummaryTiles, UpcomingPanel, WelcomeToast } from "./dashboard";

export const metadata: Metadata = { title: "Calendar" };

const VIEWS: CalendarView[] = ["month", "week", "agenda"];

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/calendar">, "searchParams">) {
  const { supabase, profile } = await requireMember();
  const params = await searchParams;
  const view = VIEWS.includes(params.view as CalendarView) ? (params.view as CalendarView) : "month";
  const now = new Date();
  const todayKey = dayKey(now);
  const anchor = parseDayKey(typeof params.date === "string" ? params.date : undefined, now);

  // Visible range in Amsterdam days, converted to instants for the query.
  let fromKey: string;
  let toKey: string;
  if (view === "week") {
    fromKey = weekStartKey(anchor);
    toKey = addDaysToKey(fromKey, 7);
  } else if (view === "agenda") {
    fromKey = `${anchor.slice(0, 7)}-01`;
    toKey = `${shiftMonthKey(anchor.slice(0, 7), 1)}-01`;
  } else {
    const weeks = monthGrid(anchor.slice(0, 7));
    fromKey = weeks[0][0];
    toKey = addDaysToKey(weeks.at(-1)![6], 1);
  }

  const [rangeResult, upcomingResult, membersResult] = await Promise.allSettled([
    getBookingsInRange(supabase, startOfLocalDay(fromKey), startOfLocalDay(toKey)),
    getUpcomingBookings(supabase, { limit: 60 }),
    getActiveMembers(supabase),
  ]);

  const hour = nowInZone().getHours();
  const greeting = hour < 6 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {typeof params.welcome === "string" && <WelcomeToast name={profile.display_name} />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting}, {profile.display_name} · {dayKeyLabel(todayKey, "EEEE d MMMM")}
          </p>
          <h1 className="mt-0.5 text-[2rem] leading-tight font-semibold sm:text-[2.35rem]">
            {dayKeyLabel(`${anchor.slice(0, 7)}-01`, "MMMM")}{" "}
            <span className="font-normal text-muted-foreground">{anchor.slice(0, 4)}</span>
          </h1>
        </div>
      </header>

      {upcomingResult.status === "fulfilled" ? (
        <SummaryTiles bookings={upcomingResult.value} viewerId={profile.id} nowIso={now.toISOString()} />
      ) : (
        <ErrorNotice title="Couldn't load the house status" />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Calendar" className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-card">
          {rangeResult.status === "fulfilled" ? (
            <Calendar view={view} anchor={anchor} todayKey={todayKey} nowIso={now.toISOString()} bookings={rangeResult.value} />
          ) : (
            <div className="p-4">
              <ErrorNotice title="Couldn't load the calendar" />
            </div>
          )}
        </section>

        <div className="space-y-6">
          {upcomingResult.status === "fulfilled" ? (
            <UpcomingPanel bookings={upcomingResult.value.slice(0, 5)} total={upcomingResult.value.length} />
          ) : (
            <ErrorNotice title="Couldn't load upcoming bookings" />
          )}
          {membersResult.status === "fulfilled" ? (
            <MemberLegend members={membersResult.value} viewerId={profile.id} />
          ) : (
            <ErrorNotice title="Couldn't load members" />
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading calendar">
      <div className="space-y-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-52" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[5.5rem] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-[34rem] rounded-xl" />
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
