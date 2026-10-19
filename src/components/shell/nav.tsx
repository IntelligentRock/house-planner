"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  CalendarDays,
  CalendarHeart,
  ChevronsUpDown,
  KeyRound,
  ListChecks,
  LogOut,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBookingDialogs } from "@/components/bookings/booking-dialogs";
import { HouseLogo } from "@/components/house-logo";
import { MemberAvatar } from "@/components/member-avatar";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/calendar", label: "Calendar", short: "Calendar", icon: CalendarDays },
  { href: "/bookings", label: "Upcoming bookings", short: "Upcoming", icon: ListChecks },
  { href: "/bookings/mine", label: "My bookings", short: "Mine", icon: CalendarHeart },
  { href: "/members", label: "Members", short: "Members", icon: Users },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
] as const;

const ADMIN_NAV = [{ href: "/invitations", label: "Invitations", icon: KeyRound }] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/bookings" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
}

export function Sidebar({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const isActive = useIsActive();
  const { openNew } = useBookingDialogs();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="px-4 pt-5 pb-4">
        <Link href="/calendar" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <HouseLogo subtitle="Family bookings" />
        </Link>
      </div>
      <div className="px-3 pb-3">
        <Button className="w-full justify-start" size="lg" onClick={() => openNew()}>
          <Plus aria-hidden /> New booking
        </Button>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </ul>
        {isAdmin && (
          <div>
            <p className="px-2.5 pb-1.5 text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Admin</p>
            <ul className="space-y-0.5">
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.href} {...item} active={isActive(item.href)} />
              ))}
            </ul>
          </div>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <AccountMenu email={email} variant="sidebar" />
      </div>
    </aside>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Users; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[0.9rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-card text-foreground shadow-card"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Icon className={cn("size-4", active ? "text-primary" : "")} aria-hidden />
        {label}
      </Link>
    </li>
  );
}

/** Phone/tablet chrome: a top bar and a bottom tab bar. */
export function MobileNav({ email }: { email: string }) {
  const isActive = useIsActive();
  const { openNew } = useBookingDialogs();
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/calendar" className="flex min-w-0 items-center gap-2 rounded-md">
          <HouseLogo />
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="icon" onClick={() => openNew()} aria-label="New booking">
            <Plus />
          </Button>
          <AccountMenu email={email} variant="compact" />
        </div>
      </header>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV.slice(0, 4).map(({ href, short, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function AccountMenu({ email, variant }: { email: string; variant: "sidebar" | "compact" }) {
  const { viewer } = useBookingDialogs();
  const [pending, startTransition] = useTransition();
  const isAdmin = viewer.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "sidebar" ? (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu" />
          )
        }
      >
        <MemberAvatar member={viewer} size={variant === "sidebar" ? "md" : "sm"} decorative />
        {variant === "sidebar" && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{viewer.display_name}</span>
              <span className="block truncate text-xs text-muted-foreground">{isAdmin ? "Administrator" : "Member"}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="text-sm font-medium text-foreground">{viewer.display_name}</span>
            <span className="truncate font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings aria-hidden /> Profile &amp; settings
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem render={<Link href="/invitations" />}>
            <KeyRound aria-hidden /> Invitations
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
        >
          <LogOut aria-hidden /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

