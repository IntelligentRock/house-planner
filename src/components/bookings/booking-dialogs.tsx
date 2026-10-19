"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import type { BookingWithMember, MemberRole, MemberSummary } from "@/lib/types";
import { BookingDetails } from "./booking-details";
import { BookingForm, type BookingPrefill } from "./booking-form";

export type Viewer = MemberSummary & { role: MemberRole };

type DialogState =
  | { kind: "closed" }
  | { kind: "new"; prefill?: BookingPrefill }
  | { kind: "view"; booking: BookingWithMember }
  | { kind: "edit"; booking: BookingWithMember };

type BookingDialogContext = {
  viewer: Viewer;
  openNew: (prefill?: BookingPrefill) => void;
  openBooking: (booking: BookingWithMember) => void;
};

const Ctx = createContext<BookingDialogContext | null>(null);

export function useBookingDialogs() {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useBookingDialogs must be used inside <BookingDialogProvider>");
  return ctx;
}

export function canManageBooking(viewer: Viewer, booking: BookingWithMember, now = new Date()) {
  const ownerOrAdmin = booking.user_id === viewer.id || viewer.role === "admin";
  const ended = new Date(booking.ends_at) <= now;
  return ownerOrAdmin && (!ended || viewer.role === "admin");
}

export function BookingDialogProvider({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>({ kind: "closed" });
  // Keep the last content mounted during the close animation.
  const [lastOpen, setLastOpen] = useState<DialogState>({ kind: "closed" });

  const show = useCallback((next: DialogState) => {
    setState(next);
    setLastOpen(next);
  }, []);
  const close = useCallback(() => setState({ kind: "closed" }), []);

  const value = useMemo<BookingDialogContext>(
    () => ({
      viewer,
      openNew: (prefill) => show({ kind: "new", prefill }),
      openBooking: (booking) => show({ kind: "view", booking }),
    }),
    [viewer, show],
  );

  const content = state.kind === "closed" ? lastOpen : state;

  return (
    <Ctx value={value}>
      {children}
      <ResponsiveDialog open={state.kind !== "closed"} onOpenChange={(open) => !open && close()}>
        {content.kind === "new" && <BookingForm viewer={viewer} prefill={content.prefill} onDone={close} />}
        {content.kind === "edit" && (
          <BookingForm
            viewer={viewer}
            booking={content.booking}
            onDone={close}
            onBack={() => show({ kind: "view", booking: content.booking })}
          />
        )}
        {content.kind === "view" && (
          <BookingDetails
            viewer={viewer}
            booking={content.booking}
            onEdit={() => show({ kind: "edit", booking: content.booking })}
            onDone={close}
          />
        )}
      </ResponsiveDialog>
    </Ctx>
  );
}
