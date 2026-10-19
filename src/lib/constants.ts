export const HOUSE_NAME = process.env.NEXT_PUBLIC_HOUSE_NAME?.trim() || "The Family House";

export const AVATARS = Array.from({ length: 18 }, (_, i) => `avatar-${String(i + 1).padStart(2, "0")}`);
export type AvatarKey = (typeof AVATARS)[number];

export function avatarSrc(avatar: string) {
  return AVATARS.includes(avatar) ? `/avatars/${avatar}.svg` : "/avatars/avatar-01.svg";
}

/**
 * Member colours used on the calendar. `solid` marks a member (bars, dots),
 * `soft` is the booking background and `ink` is text on `soft` (WCAG AA).
 * Keys must match the check constraint on public.profiles.color.
 */
export const MEMBER_COLORS = {
  sage: { label: "Sage", solid: "#5e8c6a", soft: "#e4eee6", ink: "#2b4a34" },
  terracotta: { label: "Terracotta", solid: "#c2643c", soft: "#f7e3d8", ink: "#733016" },
  ocean: { label: "Ocean", solid: "#3f6fa8", soft: "#e0e9f5", ink: "#1d3b61" },
  plum: { label: "Plum", solid: "#8a4f8f", soft: "#f0e3f0", ink: "#4e2656" },
  mustard: { label: "Mustard", solid: "#b88d1f", soft: "#f5ecd0", ink: "#5f480b" },
  rose: { label: "Rose", solid: "#c55a78", soft: "#f8e1e7", ink: "#73213b" },
  teal: { label: "Teal", solid: "#2f8a89", soft: "#dbefee", ink: "#124b4a" },
  slate: { label: "Slate", solid: "#5d6878", soft: "#e6e8ec", ink: "#2c3340" },
  olive: { label: "Olive", solid: "#7d8436", soft: "#edefd8", ink: "#414511" },
  coral: { label: "Coral", solid: "#e07a5f", soft: "#fbe4dc", ink: "#80351f" },
} as const;

export type MemberColor = keyof typeof MEMBER_COLORS;
export const MEMBER_COLOR_KEYS = Object.keys(MEMBER_COLORS) as MemberColor[];

export function memberColor(color: string) {
  return MEMBER_COLORS[color as MemberColor] ?? MEMBER_COLORS.slate;
}

export const BOOKING_LIMITS = {
  titleMax: 80,
  notesMax: 2000,
  minMinutes: 15,
  maxDays: 62,
} as const;

export const DISPLAY_NAME_MAX = 40;
