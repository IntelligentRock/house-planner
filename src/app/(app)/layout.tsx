import { Suspense } from "react";
import { BookingDialogProvider } from "@/components/bookings/booking-dialogs";
import { HouseMark } from "@/components/house-logo";
import { MobileNav, Sidebar } from "@/components/shell/nav";
import { RealtimeRefresh } from "@/components/shell/realtime-refresh";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMember } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

/** Resolves the member once for the whole shell; pages re-check for their own data. */
async function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireMember();
  const viewer = {
    id: profile.id,
    display_name: profile.display_name,
    avatar: profile.avatar,
    color: profile.color,
    role: profile.role,
  };

  return (
    <BookingDialogProvider viewer={viewer}>
      <RealtimeRefresh />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh bg-grain">
        <Sidebar isAdmin={profile.role === "admin"} email={user.email || profile.email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav email={user.email || profile.email} />
          <main id="main" className="mx-auto w-full max-w-[90rem] flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
            {children}
          </main>
        </div>
      </div>
    </BookingDialogProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-grain" aria-busy aria-label="Loading">
      <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="flex items-center gap-2.5">
          <HouseMark />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </aside>
      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[28rem] w-full" />
      </div>
    </div>
  );
}
