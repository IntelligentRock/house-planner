import { Suspense } from "react";
import type { Metadata } from "next";
import { ErrorNotice, PageHeader, Panel } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth";
import { getAllProfiles, getInvitations } from "@/lib/data";
import { CreateInvitation, InvitationTable } from "./invitations-client";

export const metadata: Metadata = { title: "Invitations" };

export default function InvitationsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Invitations"
        description="Create a code for each person you invite. They enter it once when joining; after that they sign in with their email."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Invitations />
      </Suspense>
    </div>
  );
}

async function Invitations() {
  // Admin-only page. RLS would return no rows to anyone else anyway.
  const { supabase } = await requireAdmin();
  let invitations, profiles;
  try {
    [invitations, profiles] = await Promise.all([getInvitations(supabase), getAllProfiles(supabase)]);
  } catch {
    return <ErrorNotice title="Couldn't load invitations" />;
  }
  const names = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel title="New invitation" description="Codes are shown once. Only a hash is stored." className="h-fit">
        <CreateInvitation />
      </Panel>
      <Panel title="Issued codes" bodyClassName="p-0 sm:p-0">
        <InvitationTable invitations={invitations} creatorNames={names} nowIso={new Date().toISOString()} />
      </Panel>
    </div>
  );
}
