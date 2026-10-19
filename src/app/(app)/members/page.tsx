import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { ColorDot, MemberAvatar } from "@/components/member-avatar";
import { ErrorNotice, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMember } from "@/lib/auth";
import { memberColor } from "@/lib/constants";
import { getAllProfiles, getBookingCounts } from "@/lib/data";
import { fmt } from "@/lib/time";
import type { Profile } from "@/lib/types";
import { MemberAdminMenu } from "./member-admin-menu";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<MembersSkeleton />}>
        <Members />
      </Suspense>
    </div>
  );
}

async function Members() {
  const { supabase, profile: viewer } = await requireMember();
  const isAdmin = viewer.role === "admin";

  let profiles: Profile[];
  let counts: Map<string, number>;
  try {
    [profiles, counts] = await Promise.all([getAllProfiles(supabase), getBookingCounts(supabase)]);
  } catch {
    return <ErrorNotice title="Couldn't load members" />;
  }

  const active = profiles.filter((p) => p.status === "active");
  const revoked = profiles.filter((p) => p.status === "revoked");
  const admins = active.filter((p) => p.role === "admin").length;

  return (
    <>
      <PageHeader
        eyebrow="Family"
        title="Members"
        description={`${active.length} ${active.length === 1 ? "person has" : "people have"} access to the house calendar, ${admins} of them ${admins === 1 ? "an administrator" : "administrators"}.`}
        actions={
          isAdmin && (
            <Button variant="outline" render={<Link href="/invitations" />} nativeButton={false}>
              <KeyRound aria-hidden /> Invite someone
            </Button>
          )
        }
      />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {active.map((p) => (
          <MemberCard key={p.id} profile={p} upcoming={counts.get(p.id) ?? 0} isSelf={p.id === viewer.id} showAdmin={isAdmin} />
        ))}
      </ul>

      {isAdmin && revoked.length > 0 && (
        <section className="space-y-3 pt-2">
          <div>
            <h2 className="font-heading text-lg font-semibold">Access removed</h2>
            <p className="text-sm text-muted-foreground">
              These accounts can no longer see or change anything. Their past bookings stay on record.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {revoked.map((p) => (
              <MemberCard key={p.id} profile={p} upcoming={counts.get(p.id) ?? 0} isSelf={false} showAdmin />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function MemberCard({
  profile: p,
  upcoming,
  isSelf,
  showAdmin,
}: {
  profile: Profile;
  upcoming: number;
  isSelf: boolean;
  showAdmin: boolean;
}) {
  const color = memberColor(p.color);
  const revoked = p.status === "revoked";
  return (
    <li className={`relative flex gap-3.5 overflow-hidden rounded-xl border bg-card p-4 shadow-card ${revoked ? "opacity-70" : ""}`}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color.solid }} />
      <MemberAvatar member={p} size="lg" decorative />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate font-medium">{p.display_name}</p>
          {isSelf && <span className="text-sm text-muted-foreground">(you)</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.role === "admin" ? (
            <Badge className="bg-primary/10 text-primary">
              <ShieldCheck aria-hidden /> Administrator
            </Badge>
          ) : (
            <Badge variant="secondary">Member</Badge>
          )}
          {revoked && <Badge variant="destructive">Access removed</Badge>}
        </div>
        <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <ColorDot color={p.color} /> {color.label}
          <span aria-hidden>·</span>
          {upcoming ? `${upcoming} upcoming ${upcoming === 1 ? "booking" : "bookings"}` : "No upcoming bookings"}
        </p>
        <p className="text-xs text-muted-foreground">Joined {fmt.date(p.created_at)}</p>
        {showAdmin && <p className="truncate text-xs text-muted-foreground">{p.email}</p>}
      </div>
      {showAdmin && !isSelf && (
        <MemberAdminMenu member={{ id: p.id, name: p.display_name, role: p.role, status: p.status }} />
      )}
    </li>
  );
}

function MembersSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading members">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
