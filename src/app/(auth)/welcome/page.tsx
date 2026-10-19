import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getViewer, homeFor } from "@/lib/auth";
import { HOUSE_NAME } from "@/lib/constants";
import { WelcomeFlow } from "./welcome-flow";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.08em] text-highlight uppercase">You&rsquo;re invited</p>
        <h1 className="text-[2rem] leading-tight font-semibold">Welcome to {HOUSE_NAME}</h1>
        <p className="text-muted-foreground">
          This is the family&rsquo;s private booking calendar. To join, enter the invitation code you were given.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <WelcomeGate />
      </Suspense>
      <p className="border-t pt-5 text-sm text-muted-foreground">
        Already a member?{" "}
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

async function WelcomeGate() {
  const viewer = await getViewer();
  if (viewer.user) redirect(homeFor(viewer));
  return <WelcomeFlow />;
}
