"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Focus is trapped and
 * restored by the underlying Base UI dialog; Escape closes it.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  className,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0 shadow-raised",
          // Phone: anchored to the bottom, full width, scrolls internally.
          "top-auto bottom-0 left-0 max-h-[94dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none",
          "data-open:slide-in-from-bottom-8 data-open:zoom-in-100",
          // Tablet and up: centred.
          "sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
          "sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95",
          wide ? "sm:max-w-xl" : "sm:max-w-lg",
          className,
        )}
      >
        <div className="flex max-h-[inherit] flex-col overflow-y-auto overscroll-contain">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
