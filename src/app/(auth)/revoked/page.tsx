import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getViewer, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Access removed" };

export default function RevokedPage() {
  return (
    <Suspense>
      <RevokedGate />
    </Suspense>
  );
}

async function RevokedGate() {
  const viewer = await getViewer();
  const home = homeFor(viewer);
  if (home !== "/revoked") redirect(home);

  return (
    <div className="space-y-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent">
        <LockKeyhole className="size-5" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-[2rem] leading-tight font-semibold">Your access has been paused</h1>
        <p className="text-muted-foreground">
          An administrator has removed access for <strong className="font-medium text-foreground">{viewer.user?.email}</strong>. If
          you think this is a mistake, ask one of the family administrators to restore it.
        </p>
      </div>
      <SignOutButton />
    </div>
  );
}
