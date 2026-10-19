import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getStoredInviteCode } from "@/lib/invite-cookie";
import { getViewer, homeFor } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.08em] text-highlight uppercase">Last step</p>
        <h1 className="text-[2rem] leading-tight font-semibold">How should the family see you?</h1>
        <p className="text-muted-foreground">Your name and avatar appear on your bookings. You can change them later.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OnboardingGate />
      </Suspense>
    </div>
  );
}

async function OnboardingGate() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/welcome");
  if (viewer.profile) redirect(homeFor(viewer));
  const storedCode = await getStoredInviteCode();
  return <OnboardingForm email={viewer.user.email} storedCode={storedCode} />;
}
