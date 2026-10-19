import { cn } from "@/lib/utils";
import { avatarSrc, memberColor } from "@/lib/constants";
import type { MemberSummary } from "@/lib/types";

const SIZES = {
  xs: "size-5",
  sm: "size-7",
  md: "size-9",
  lg: "size-12",
  xl: "size-20",
} as const;

/** Preset avatar with a ring in the member's calendar colour. */
export function MemberAvatar({
  member,
  size = "md",
  className,
  decorative = false,
}: {
  member: Pick<MemberSummary, "display_name" | "avatar" | "color"> | null;
  size?: keyof typeof SIZES;
  className?: string;
  /** Hide from assistive tech when the name is printed next to it. */
  decorative?: boolean;
}) {
  const color = memberColor(member?.color ?? "slate");
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted",
        size === "xs" ? "ring-[1.5px]" : "ring-2",
        "ring-offset-1 ring-offset-card",
        SIZES[size],
        className,
      )}
      style={{ "--tw-ring-color": color.solid } as React.CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs */}
      <img
        src={avatarSrc(member?.avatar ?? "")}
        alt={decorative ? "" : member ? `${member.display_name}'s avatar` : "Former member"}
        className="size-full object-cover"
        draggable={false}
      />
    </span>
  );
}

/** Avatar + name, the standard way to show who something belongs to. */
export function MemberChip({
  member,
  size = "sm",
  suffix,
  className,
}: {
  member: MemberSummary | null;
  size?: "xs" | "sm" | "md";
  suffix?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <MemberAvatar member={member} size={size} decorative />
      <span className="truncate font-medium">{member?.display_name ?? "Former member"}</span>
      {suffix}
    </span>
  );
}

/** Small colour swatch, always paired with a text label by callers. */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: memberColor(color).solid }}
    />
  );
}
