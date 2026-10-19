"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { AvatarPicker } from "@/components/profile/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboarding, signOut } from "@/lib/actions/auth";
import { AVATARS, DISPLAY_NAME_MAX } from "@/lib/constants";
import { formatInviteCode } from "@/lib/invitations";

export function OnboardingForm({ email, storedCode }: { email: string; storedCode: string | null }) {
  const [code, setCode] = useState(storedCode ? formatInviteCode(storedCode) : "");
  const [editingCode, setEditingCode] = useState(!storedCode);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await completeOnboarding({ code, displayName, avatar });
        if (result && !result.ok) {
          setErrors(result.fieldErrors ?? {});
          if (result.fieldErrors?.code) setEditingCode(true);
          if (!result.fieldErrors) setFormError(result.error);
        }
      } catch (e) {
        if (e && typeof e === "object" && "digest" in e) throw e;
        setFormError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-card">
        <MemberAvatar member={{ display_name: displayName || "You", avatar, color: "sage" }} size="lg" decorative />
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName.trim() || "Your name"}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX}
          placeholder="e.g. Oma Jet, Pieter, The Jansens"
          autoComplete="nickname"
          autoFocus
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={errors.displayName ? "name-error" : undefined}
        />
        {errors.displayName && (
          <p id="name-error" className="text-[0.8rem] font-medium text-destructive">
            {errors.displayName}
          </p>
        )}
      </div>

      <AvatarPicker value={avatar} onChange={setAvatar} error={errors.avatar} />

      {editingCode ? (
        <div className="space-y-1.5">
          <Label htmlFor="code">Invitation code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(formatInviteCode(e.target.value))}
            placeholder="ABCD-EFGH-JKMN"
            autoComplete="off"
            spellCheck={false}
            className="font-mono tracking-[0.12em] uppercase"
            aria-invalid={errors.code ? true : undefined}
            aria-describedby={errors.code ? "code-error" : undefined}
          />
          {errors.code && (
            <p id="code-error" className="text-[0.8rem] font-medium text-destructive">
              {errors.code}
            </p>
          )}
        </div>
      ) : (
        <p className="flex items-center justify-between gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4" aria-hidden /> Invitation <span className="font-mono">{code}</span>
          </span>
          <button type="button" className="text-xs underline underline-offset-4" onClick={() => setEditingCode(true)}>
            Change
          </button>
        </p>
      )}

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Joining…" : "Join the house"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Not {email}?{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => startTransition(() => signOut())}>
            Sign out
          </button>
        </p>
      </div>
    </form>
  );
}
