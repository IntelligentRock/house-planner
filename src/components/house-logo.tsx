import { cn } from "@/lib/utils";
import { HOUSE_NAME } from "@/lib/constants";

export function HouseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="7" fill="var(--primary)" />
      <path
        d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1h-4.5v-5.5h-5V25H9a1 1 0 0 1-1-1z"
        fill="var(--primary-foreground)"
      />
      <path d="M20.5 8.5h2v4" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="15.8" r="1.6" fill="var(--highlight)" />
    </svg>
  );
}

export function HouseLogo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <HouseMark />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-heading text-[1.05rem] font-semibold">{HOUSE_NAME}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  );
}
