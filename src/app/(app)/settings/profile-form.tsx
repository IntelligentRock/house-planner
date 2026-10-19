"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { AvatarPicker, ColorPicker } from "@/components/profile/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/members";
import { DISPLAY_NAME_MAX } from "@/lib/constants";

type ProfileFields = { display_name: string; avatar: string; color: string };

export function ProfileForm({ profile }: { profile: ProfileFields }) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [color, setColor] = useState(profile.color);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const dirty = displayName !== profile.display_name || avatar !== profile.avatar || color !== profile.color;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !dirty) return;
    setErrors({});
    startTransition(async () => {
      try {
        const result = await updateProfile({ displayName, avatar, color });
        if (result.ok) toast.success("Profile saved");
        else {
          setErrors(result.fieldErrors ?? {});
          toast.error(result.error);
        }
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="flex items-center gap-4">
        <MemberAvatar member={{ display_name: displayName, avatar, color }} size="xl" decorative />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="nickname"
            aria-invalid={errors.displayName ? true : undefined}
            aria-describedby={errors.displayName ? "name-error" : undefined}
          />
          {errors.displayName && (
            <p id="name-error" className="text-[0.8rem] font-medium text-destructive">
              {errors.displayName}
            </p>
          )}
        </div>
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} error={errors.avatar} />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || pending}
          onClick={() => {
            setDisplayName(profile.display_name);
            setAvatar(profile.avatar);
            setColor(profile.color);
            setErrors({});
          }}
        >
          Reset
        </Button>
        <Button type="submit" disabled={!dirty || pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save profile
        </Button>
      </div>
    </form>
  );
}
