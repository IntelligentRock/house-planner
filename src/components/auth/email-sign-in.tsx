"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendSignInEmail, verifyEmailCode } from "@/lib/actions/auth";

/**
 * Email step shared by sign-in and enrolment: request a magic link, then
 * either click it or type the one-time code from the same email.
 */
export function EmailSignIn({ submitLabel = "Email me a sign-in link", onBack }: { submitLabel?: string; onBack?: () => void }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await sendSignInEmail(email);
        if (result.ok) setSentTo(result.data.email);
        else setError(result.error);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function verify(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !sentTo) return;
    setError(null);
    startTransition(async () => {
      try {
        // Redirects on success.
        const result = await verifyEmailCode(sentTo, token);
        if (result && !result.ok) setError(result.error);
      } catch (e) {
        // Next.js redirects surface as thrown errors in some versions; let them through.
        if (e && typeof e === "object" && "digest" in e) throw e;
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  if (sentTo) {
    return (
      <div className="space-y-5">
        <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div role="status">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-0.5 text-muted-foreground">
              We sent a sign-in link to <strong className="font-medium text-foreground">{sentTo}</strong>. Open it on this
              device, or enter the code from the email below.
            </p>
          </div>
        </div>

        <form onSubmit={verify} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="otp">Code from the email</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="h-11 text-center font-mono text-lg tracking-[0.3em]"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "auth-error" : undefined}
            />
          </div>
          {error && (
            <p id="auth-error" role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending || token.length < 6}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Continue
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setSentTo(null);
              setToken("");
              setError(null);
            }}
          >
            Use a different email
          </button>
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
            onClick={() => send()}
            disabled={pending}
          >
            Resend email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "auth-error" : "email-hint"}
        />
        <p id="email-hint" className="text-xs text-muted-foreground">
          No password needed — we&rsquo;ll email you a link and a code.
        </p>
      </div>
      {error && (
        <p id="auth-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" className="w-full" disabled={pending || !email.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Sending…" : submitLabel}
        </Button>
        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden /> Back
          </Button>
        )}
      </div>
    </form>
  );
}
