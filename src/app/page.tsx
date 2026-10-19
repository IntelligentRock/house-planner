import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HouseMark } from "@/components/house-logo";
import { getViewer, homeFor } from "@/lib/auth";

/** Sends each visitor to the right place: welcome, onboarding or the calendar. */
export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-grain" aria-busy>
          <HouseMark className="size-10 animate-pulse" />
        </main>
      }
    >
      <Route />
    </Suspense>
  );
}

async function Route(): Promise<never> {
  redirect(homeFor(await getViewer()));
}
