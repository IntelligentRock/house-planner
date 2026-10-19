"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateMember } from "@/lib/actions/members";
import type { MemberRole, MemberStatus } from "@/lib/types";

type Change = { role?: MemberRole; status?: MemberStatus };

const CONFIRM: Record<string, { title: (n: string) => string; body: (n: string) => string; cta: string; destructive?: boolean }> = {
  revoke: {
    title: (n) => `Remove ${n}'s access?`,
    body: (n) =>
      `${n} will immediately lose access to the calendar and can no longer book. Their existing bookings stay on the calendar; cancel them separately if needed. You can restore access later.`,
    cta: "Remove access",
    destructive: true,
  },
  admin: {
    title: (n) => `Make ${n} an administrator?`,
    body: (n) => `${n} will be able to invite people, manage members and edit or cancel anyone's bookings.`,
    cta: "Make administrator",
  },
  member: {
    title: (n) => `Remove ${n}'s administrator role?`,
    body: (n) => `${n} will keep access as a regular member.`,
    cta: "Make member",
  },
  restore: {
    title: (n) => `Restore ${n}'s access?`,
    body: (n) => `${n} will be able to see the calendar and book again.`,
    cta: "Restore access",
  },
};

export function MemberAdminMenu({
  member,
}: {
  member: { id: string; name: string; role: MemberRole; status: MemberStatus };
}) {
  const [confirm, setConfirm] = useState<keyof typeof CONFIRM | null>(null);
  const [pending, startTransition] = useTransition();

  const changes: Record<keyof typeof CONFIRM, Change> = {
    revoke: { status: "revoked" },
    restore: { status: "active" },
    admin: { role: "admin" },
    member: { role: "member" },
  };

  function apply() {
    if (!confirm) return;
    startTransition(async () => {
      try {
        const result = await updateMember(member.id, changes[confirm]);
        if (result.ok) toast.success(`${CONFIRM[confirm].cta}: done`, { description: member.name });
        else toast.error(result.error);
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
      setConfirm(null);
    });
  }

  const c = confirm ? CONFIRM[confirm] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1" aria-label={`Manage ${member.name}`} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {member.status === "active" ? (
            <>
              {member.role === "member" ? (
                <DropdownMenuItem onClick={() => setConfirm("admin")}>
                  <ShieldCheck aria-hidden /> Make administrator
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setConfirm("member")}>
                  <ShieldOff aria-hidden /> Make regular member
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm("revoke")}>
                <UserX aria-hidden /> Remove access
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => setConfirm("restore")}>
              <UserCheck aria-hidden /> Restore access
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && !pending && setConfirm(null)}>
        <AlertDialogContent>
          {c && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{c.title(member.name)}</AlertDialogTitle>
                <AlertDialogDescription>{c.body(member.name)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <Button
                  onClick={apply}
                  disabled={pending}
                  className={c.destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
                >
                  {pending && <Loader2 className="animate-spin" aria-hidden />}
                  {c.cta}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
