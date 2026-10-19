import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { BookingList, NewBookingButton } from "@/components/bookings/booking-list";
import { ErrorNotice, PageHeader, Panel } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMember } from "@/lib/auth";
import { getUpcomingBookings } from "@/lib/data";

export const metadata: Metadata = { title: "Upcoming bookings" };

export default function UpcomingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Bookings"
        title="Upcoming bookings"
        description="Everything booked from now on, by everyone in the family."
        actions={<NewBookingButton />}
      />
      <Suspense fallback={<ListSkeleton />}>
        <UpcomingList />
      </Suspense>
    </div>
  );
}

async function UpcomingList() {
  const { supabase } = await requireMember();
  let bookings;
  try {
    bookings = await getUpcomingBookings(supabase);
  } catch {
    return <ErrorNotice title="Couldn't load upcoming bookings" />;
  }
  return (
    <Panel>
      <BookingList
        bookings={bookings}
        empty={{
          icon: <CalendarClock />,
          title: "Nothing booked yet",
          body: "No one has booked the house for the coming period. Be the first!",
          showCreate: true,
        }}
      />
    </Panel>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5" aria-busy aria-label="Loading bookings">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
