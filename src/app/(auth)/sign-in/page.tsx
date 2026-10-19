import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { Skeleton } from "@/components/ui/skeleton";
import { getViewer, homeFor } from "@/lib/auth";
import { friendlyAuthError } from "@/lib/errors";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-[2rem] leading-tight font-semibold">Welcome back</h1>
        <p className="text-muted-foreground">Sign in with the email address you joined with.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <SignInGate searchParams={searchParams} />
      </Suspense>
      <p className="border-t pt-5 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/welcome" className="font-medium text-primary underline-offset-4 hover:underline">
          Enter your invitation code
        </Link>
      </p>
    </div>
  );
}

async function SignInGate({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const viewer = await getViewer();
  if (viewer.user) redirect(homeFor(viewer));
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const signedOut = "signed-out" in params;

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>{friendlyAuthError(error)}</p>
        </div>
      )}
      {signedOut && !error && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg bg-success-soft p-3 text-sm text-success">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          You&rsquo;ve been signed out.
        </div>
      )}
      <EmailSignIn />
    </div>
  );
}
