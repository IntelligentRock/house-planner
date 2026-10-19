"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared body for error boundaries: explains, offers a retry and a way home. */
export function ErrorFallback({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        We couldn&rsquo;t load this page. Your bookings are safe — this is usually a temporary connection problem.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        <Button variant="outline" render={<Link href="/calendar" />} nativeButton={false}>
          Go to calendar
        </Button>
      </div>
    </div>
  );
}
