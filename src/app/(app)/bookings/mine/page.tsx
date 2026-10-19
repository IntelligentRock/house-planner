import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarHeart, History } from "lucide-react";
import { BookingList, NewBookingButton } from "@/components/bookings/booking-list";
import { ErrorNotice, PageHeader, Panel } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMember } from "@/lib/auth";
import { getPastBookings, getUpcomingBookings } from "@/lib/data";

export const metadata: Metadata = { title: "My bookings" };

export default function MyBookingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Bookings"
        title="My bookings"
        description="Your upcoming stays and visits. Open one to change or cancel it."
        actions={<NewBookingButton />}
      />
      <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
        <MyLists />
      </Suspense>
    </div>
  );
}

async function MyLists() {
  const { supabase, user } = await requireMember();
  let upcoming, past;
  try {
    [upcoming, past] = await Promise.all([
      getUpcomingBookings(supabase, { userId: user.id }),
      getPastBookings(supabase, { userId: user.id, limit: 12 }),
    ]);
  } catch {
    return <ErrorNotice title="Couldn't load your bookings" />;
  }
  return (
    <div className="space-y-6">
      <Panel title="Upcoming" description={upcoming.length ? `${upcoming.length} planned` : undefined}>
        <BookingList
          bookings={upcoming}
          empty={{
            icon: <CalendarHeart />,
            title: "You have no upcoming bookings",
            body: "When you book the house, your stays will show up here.",
            showCreate: true,
          }}
        />
      </Panel>
      <Panel title="Past" description="Your most recent completed bookings.">
        <BookingList
          bookings={past}
          order="desc"
          empty={{ icon: <History />, title: "No past bookings yet", body: "Completed stays will be listed here." }}
        />
      </Panel>
    </div>
  );
}
