"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyInvitation } from "@/lib/actions/auth";
import { formatInviteCode, looksLikeInviteCode } from "@/lib/invitations";
import { cn } from "@/lib/utils";

const STEPS = ["Invitation", "Email", "Profile"];

export function WelcomeFlow() {
  const [step, setStep] = useState<0 | 1>(0);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!looksLikeInviteCode(code)) {
      setError("Invitation codes have 12 letters and numbers, like ABCD-EFGH-JKMN.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await verifyInvitation(code);
        if (result.ok) setStep(1);
        else setError(result.fieldErrors?.code ?? result.error);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[0.7rem]",
                i < step && "bg-primary text-primary-foreground",
                i === step && "bg-foreground text-background",
                i > step && "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <CheckCircle2 className="size-3.5" aria-label="done" /> : i + 1}
            </span>
            <span className={i === step ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            {i < STEPS.length - 1 && <span aria-hidden className="h-px w-5 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <form onSubmit={submitCode} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="invite-code">Invitation code</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="invite-code"
                value={code}
                onChange={(e) => setCode(formatInviteCode(e.target.value))}
                placeholder="ABCD-EFGH-JKMN"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
                className="h-12 pl-9 font-mono text-lg tracking-[0.12em] uppercase"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "code-error" : "code-hint"}
              />
            </div>
            {error ? (
              <p id="code-error" role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : (
              <p id="code-hint" className="text-xs text-muted-foreground">
                You only need this once. Afterwards you sign in with your email.
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending || code.length < 14}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? "Checking…" : "Continue"}
            {!pending && <ArrowRight aria-hidden />}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Invitation code accepted.
          </p>
          <p className="text-sm text-muted-foreground">
            Now enter your email address. We&rsquo;ll send you a link to create your account — no password needed.
          </p>
          <EmailSignIn submitLabel="Send my sign-in link" onBack={() => setStep(0)} />
        </div>
      )}
    </div>
  );
}
