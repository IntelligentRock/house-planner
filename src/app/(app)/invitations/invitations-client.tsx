"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Ban } from "lucide-react";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { EmptyState } from "@/components/page";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvitation, revokeInvitation } from "@/lib/actions/members";
import { HOUSE_NAME } from "@/lib/constants";
import { fmt } from "@/lib/time";
import { invitationState, type Invitation, type InvitationState } from "@/lib/types";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CreateInvitation() {
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [maxUses, setMaxUses] = useState("1");
  const [expires, setExpires] = useState("14");
  const [created, setCreated] = useState<{ code: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createInvitation({ label, role, maxUses, expiresInDays: expires });
        if (result.ok) {
          setCreated({ code: result.data.code, label });
          setLabel("");
        } else setError(result.error);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="inv-label">Who is it for?</Label>
          <Input id="inv-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="e.g. Cousin Sam" />
          <p className="text-xs text-muted-foreground">A private note so you can recognise the code later.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-expires">Expires after</Label>
            <select id="inv-expires" className={selectClass} value={expires} onChange={(e) => setExpires(e.target.value)}>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="0">Never</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-uses">Can be used</Label>
            <select id="inv-uses" className={selectClass} value={maxUses} onChange={(e) => setMaxUses(e.target.value)}>
              <option value="1">Once</option>
              <option value="2">2 times</option>
              <option value="5">5 times</option>
              <option value="10">10 times</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-role">Joins as</Label>
          <select id="inv-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </select>
          {role === "admin" && (
            <p className="text-xs text-warning">Administrators can manage members and everyone&rsquo;s bookings.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
          Create invitation code
        </Button>
      </form>

      <ResponsiveDialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
        {created && <CreatedCode code={created.code} label={created.label} onDone={() => setCreated(null)} />}
      </ResponsiveDialog>
    </>
  );
}

function CreatedCode({ code, label, onDone }: { code: string; label: string; onDone: () => void }) {
  const [copied, setCopied] = useState<"code" | "message" | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const message = `You're invited to ${HOUSE_NAME}'s booking calendar! Go to ${origin}/welcome and enter this code: ${code}`;

  async function copy(text: string, what: "code" | "message") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy automatically. Select the text and copy it manually.");
    }
  }

  return (
    <div className="space-y-5 p-5">
      <div>
        <DialogTitle className="text-xl font-semibold">Invitation created</DialogTitle>
        <DialogDescription className="mt-1">
          {label ? `For ${label}. ` : ""}Copy it now — for security, the code can&rsquo;t be shown again.
        </DialogDescription>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
        <code className="font-mono text-xl font-semibold tracking-[0.12em] select-all">{code}</code>
        <Button size="sm" variant="outline" onClick={() => copy(code, "code")}>
          {copied === "code" ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied === "code" ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Message to send</p>
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground select-all">{message}</p>
        <Button size="sm" variant="ghost" onClick={() => copy(message, "message")}>
          {copied === "message" ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied === "message" ? "Copied" : "Copy message"}
        </Button>
      </div>
      <div className="flex justify-end border-t pt-4">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

const STATE_STYLE: Record<InvitationState, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success-soft text-success" },
  used: { label: "Used", className: "bg-secondary text-secondary-foreground" },
  expired: { label: "Expired", className: "bg-warning-soft text-warning" },
  revoked: { label: "Revoked", className: "bg-destructive/10 text-destructive" },
};

export function InvitationTable({
  invitations,
  creatorNames,
  nowIso,
}: {
  invitations: Invitation[];
  creatorNames: Record<string, string>;
  nowIso: string;
}) {
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [pending, startTransition] = useTransition();
  const now = new Date(nowIso);

  function confirmRevoke() {
    if (!revoking) return;
    startTransition(async () => {
      try {
        const result = await revokeInvitation(revoking.id);
        if (result.ok) toast.success("Invitation revoked", { description: `Code ending in ${revoking.code_hint}` });
        else toast.error(result.error);
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
      setRevoking(null);
    });
  }

  if (invitations.length === 0) {
    return (
      <EmptyState icon={<KeyRound />} title="No invitations yet">
        Create a code on the left and send it to a family member.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {invitations.map((inv) => {
          const state = invitationState(inv, now);
          const style = STATE_STYLE[state];
          return (
            <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-sm text-muted-foreground">••••-••••-{inv.code_hint}</code>
                  <Badge className={cn(style.className)}>{style.label}</Badge>
                  {inv.role === "admin" && <Badge variant="outline">Admin</Badge>}
                </div>
                <p className="mt-1 truncate text-sm font-medium">{inv.label || <span className="text-muted-foreground italic">No note</span>}</p>
                <p className="text-xs text-muted-foreground">
                  Used {inv.use_count}/{inv.max_uses} ·{" "}
                  {inv.expires_at ? `${state === "expired" ? "expired" : "expires"} ${fmt.dateTime(inv.expires_at)}` : "never expires"} · created{" "}
                  {fmt.date(inv.created_at)}
                  {inv.created_by && creatorNames[inv.created_by] ? ` by ${creatorNames[inv.created_by]}` : ""}
                </p>
              </div>
              {state === "active" && (
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRevoking(inv)}>
                  <Ban aria-hidden /> Revoke
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && !pending && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The code ending in <span className="font-mono">{revoking?.code_hint}</span>
              {revoking?.label ? ` (${revoking.label})` : ""} will stop working immediately. People who already joined with it keep their access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmRevoke} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Revoke code
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
