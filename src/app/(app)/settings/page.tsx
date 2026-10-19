import { Suspense } from "react";
import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader, Panel } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMember } from "@/lib/auth";
import { fmt } from "@/lib/time";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Account" title="Profile & settings" description="How you appear to the rest of the family." />
      <Suspense fallback={<Skeleton className="h-[32rem] rounded-xl" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const { profile, user } = await requireMember();
  return (
    <div className="space-y-6">
      <Panel title="Profile">
        <ProfileForm profile={{ display_name: profile.display_name, avatar: profile.avatar, color: profile.color }} />
      </Panel>
      <Panel title="Account">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium break-all">{user.email || profile.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{profile.role === "admin" ? "Administrator" : "Member"}</dd>
          <dt className="text-muted-foreground">Member since</dt>
          <dd className="font-medium">{fmt.dayLong(profile.created_at)}</dd>
          <dt className="text-muted-foreground">Signing in</dt>
          <dd>Passwordless — we email you a link and a code each time you sign in on a new device.</dd>
        </dl>
        <div className="mt-5 border-t pt-4">
          <SignOutButton />
        </div>
      </Panel>
    </div>
  );
}
