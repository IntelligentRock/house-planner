"use client";

import { Check } from "lucide-react";
import { AVATARS, MEMBER_COLORS, MEMBER_COLOR_KEYS, avatarSrc } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Native radio inputs: arrow keys, labels and form semantics come for free. */
export function AvatarPicker({
  value,
  onChange,
  name = "avatar",
  error,
}: {
  value: string;
  onChange: (avatar: string) => void;
  name?: string;
  error?: string;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium">Avatar</legend>
      <div className="grid grid-cols-6 gap-2">
        {AVATARS.map((avatar, i) => (
          <label key={avatar} className="group relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={avatar}
              checked={value === avatar}
              onChange={() => onChange(avatar)}
              className="peer sr-only"
            />
            <span className="sr-only">Avatar {i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs */}
            <img
              src={avatarSrc(avatar)}
              alt=""
              className={cn(
                "aspect-square w-full rounded-full bg-muted ring-offset-2 ring-offset-card transition",
                "group-hover:scale-[1.04] peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                value === avatar ? "ring-2 ring-primary" : "opacity-85 group-hover:opacity-100",
              )}
            />
            {value === avatar && (
              <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" aria-hidden />
              </span>
            )}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-[0.8rem] font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Calendar colour</legend>
      <p className="mb-2.5 text-xs text-muted-foreground">Your bookings use this colour on the calendar.</p>
      <div className="flex flex-wrap gap-2">
        {MEMBER_COLOR_KEYS.map((key) => {
          const c = MEMBER_COLORS[key];
          return (
            <label key={key} className="relative cursor-pointer" title={c.label}>
              <input
                type="radio"
                name="color"
                value={key}
                checked={value === key}
                onChange={() => onChange(key)}
                className="peer sr-only"
              />
              <span className="sr-only">{c.label}</span>
              <span
                aria-hidden
                className={cn(
                  "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                  value === key && "ring-2 ring-foreground/70",
                )}
                style={{ backgroundColor: c.solid }}
              >
                {value === key && <Check className="size-4 text-white" />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
