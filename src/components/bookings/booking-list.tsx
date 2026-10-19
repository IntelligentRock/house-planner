"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingRow } from "@/components/calendar/calendar";
import { EmptyState } from "@/components/page";
import { monthKeyOf, dayKeyLabel } from "@/lib/time";
import type { BookingWithMember } from "@/lib/types";
import { useBookingDialogs } from "./booking-dialogs";

/** Bookings grouped under month headings. */
export function BookingList({
  bookings,
  empty,
  order = "asc",
}: {
  bookings: BookingWithMember[];
  empty: { title: string; body: string; showCreate?: boolean; icon?: React.ReactNode };
  order?: "asc" | "desc";
}) {
  const { openBooking, openNew } = useBookingDialogs();

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        action={
          empty.showCreate && (
            <Button onClick={() => openNew()}>
              <Plus aria-hidden /> New booking
            </Button>
          )
        }
      >
        {empty.body}
      </EmptyState>
    );
  }

  const groups = new Map<string, BookingWithMember[]>();
  for (const b of bookings) {
    const key = monthKeyOf(b.starts_at);
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const keys = [...groups.keys()];
  if (order === "desc") keys.sort().reverse();

  return (
    <div className="space-y-6">
      {keys.map((key) => (
        <section key={key} aria-labelledby={`m-${key}`}>
          <h3 id={`m-${key}`} className="mb-2 flex items-baseline gap-2 font-heading text-base font-semibold">
            {dayKeyLabel(`${key}-01`, "MMMM")}
            <span className="text-sm font-normal text-muted-foreground">{key.slice(0, 4)}</span>
            <span className="ml-auto font-sans text-xs font-normal text-muted-foreground">
              {groups.get(key)!.length} {groups.get(key)!.length === 1 ? "booking" : "bookings"}
            </span>
          </h3>
          <ul className="space-y-2">
            {groups.get(key)!.map((b) => (
              <li key={b.id}>
                <BookingRow booking={b} onOpen={() => openBooking(b)} showDate />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function NewBookingButton({ className }: { className?: string }) {
  const { openNew } = useBookingDialogs();
  return (
    <Button className={className} onClick={() => openNew()}>
      <Plus aria-hidden /> New booking
    </Button>
  );
}
