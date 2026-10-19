"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, Clock, Loader2, Pencil, StickyNote, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MemberAvatar } from "@/components/member-avatar";
import { cancelBooking } from "@/lib/actions/bookings";
import { memberColor } from "@/lib/constants";
import { fmt, formatDuration, formatRange } from "@/lib/time";
import type { BookingWithMember } from "@/lib/types";
import { canManageBooking, type Viewer } from "./booking-dialogs";

export function bookingPhase(booking: BookingWithMember, now = new Date()) {
  if (new Date(booking.ends_at) <= now) return "past" as const;
  if (new Date(booking.starts_at) <= now) return "ongoing" as const;
  return "upcoming" as const;
}

export function PhaseBadge({ booking }: { booking: BookingWithMember }) {
  const phase = bookingPhase(booking);
  if (phase === "ongoing") return <Badge className="bg-success-soft text-success">Happening now</Badge>;
  if (phase === "past") return <Badge variant="secondary">Past</Badge>;
  return null;
}

export function BookingDetails({
  viewer,
  booking,
  onEdit,
  onDone,
}: {
  viewer: Viewer;
  booking: BookingWithMember;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const color = memberColor(booking.member?.color ?? "slate");
  const isOwner = booking.user_id === viewer.id;
  const canManage = canManageBooking(viewer, booking);

  function confirmCancel() {
    startTransition(async () => {
      try {
        const result = await cancelBooking(booking.id, booking.version);
        if (result.ok) {
          toast.success("Booking cancelled", { description: `${booking.title} · ${formatRange(booking.starts_at, booking.ends_at)}` });
          setConfirmOpen(false);
          onDone();
        } else {
          toast.error(result.error);
          setConfirmOpen(false);
          if (result.code === "STALE" || result.code === "NOT_FOUND" || result.code === "BOOKING_ALREADY_CANCELLED") onDone();
        }
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex flex-col">
      <div className="relative border-b bg-paper px-5 pt-5 pb-4">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color.solid }} />
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <DialogTitle className="text-xl font-semibold">{booking.title}</DialogTitle>
          <PhaseBadge booking={booking} />
        </div>
        <DialogDescription className="mt-2.5 flex items-center gap-2.5 text-sm">
          <MemberAvatar member={booking.member} size="sm" decorative />
          <span>
            Booked by <strong className="font-medium text-foreground">{booking.member?.display_name ?? "a former member"}</strong>
            {isOwner && <span className="text-muted-foreground"> (you)</span>}
          </span>
        </DialogDescription>
      </div>

      <dl className="space-y-4 px-5 py-5 text-sm">
        <div className="flex gap-3">
          <dt className="sr-only">When</dt>
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <dd className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium">
              {fmt.dayLong(booking.starts_at)}, <span className="tabular">{fmt.time(booking.starts_at)}</span>
            </span>
            <span className="text-muted-foreground">Until</span>
            <span className="font-medium">
              {fmt.dayLong(booking.ends_at)}, <span className="tabular">{fmt.time(booking.ends_at)}</span>
            </span>
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="sr-only">Length</dt>
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <dd>{formatDuration(booking.starts_at, booking.ends_at)}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="sr-only">Notes</dt>
          <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <dd className={booking.notes ? "whitespace-pre-wrap" : "text-muted-foreground italic"}>
            {booking.notes || "No notes"}
          </dd>
        </div>
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Booked {fmt.date(booking.created_at)}
          {booking.updated_at !== booking.created_at && <> · last changed {fmt.dateTime(booking.updated_at)}</>}
        </p>
      </dl>

      <div className="flex flex-col-reverse gap-2 border-t bg-paper px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        {canManage ? (
          <>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={pending}>
              <Trash2 aria-hidden /> Cancel booking
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={onDone}>
                Close
              </Button>
              <Button onClick={onEdit}>
                <Pencil aria-hidden /> Edit
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {bookingPhase(booking) === "past" && (isOwner || viewer.role === "admin")
                ? "This booking has ended and can no longer be changed."
                : `Only ${booking.member?.display_name ?? "the owner"} or an administrator can change this booking.`}
            </p>
            <Button variant="outline" onClick={onDone}>
              Close
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !pending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel &ldquo;{booking.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {isOwner ? "Your" : `${booking.member?.display_name ?? "This member"}'s`} booking for{" "}
              {formatRange(booking.starts_at, booking.ends_at)} will be removed from the calendar and the time becomes
              available to others. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep booking</AlertDialogCancel>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmCancel}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
