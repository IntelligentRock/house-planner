import { HouseLogo } from "@/components/house-logo";
import { HOUSE_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh bg-grain lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden border-r bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-10">
        <HouseLogo subtitle="Family bookings" />
        <HouseIllustration />
        <div className="max-w-md space-y-3">
          <p className="font-heading text-3xl leading-tight font-semibold">
            One calendar for the whole family, so everyone knows when {HOUSE_NAME.replace(/^The /, "the ")} is free.
          </p>
          <p className="text-sm text-muted-foreground">Private to invited family members.</p>
        </div>
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <HouseLogo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** A quiet line drawing of a house among trees, drawn with theme colours. */
function HouseIllustration() {
  return (
    <svg viewBox="0 0 480 300" aria-hidden className="mx-auto w-full max-w-md">
      <g fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <path d="M20 262h440" />
        {/* Trees */}
        <path d="M70 262v-48" />
        <path d="M70 160c-26 18-30 56 0 58 30-2 26-40 0-58z" fill="var(--success-soft)" />
        <path d="M410 262v-40" />
        <path d="M410 168c-22 14-26 48 0 52 26-4 22-38 0-52z" fill="var(--success-soft)" />
        <path d="M380 262v-28" />
        <path d="M380 200c-16 10-18 34 0 36 18-2 16-26 0-36z" fill="var(--success-soft)" />
        {/* House */}
        <path d="M150 262V150l90-64 90 64v112" fill="var(--card)" />
        <path d="M134 162l106-78 106 78" />
        <path d="M290 112V70h22v58" fill="var(--card)" />
        <path d="M218 262v-62h44v62" fill="var(--accent)" />
        <circle cx="252" cy="232" r="2.5" fill="var(--foreground)" />
        <rect x="170" y="180" width="32" height="32" rx="2" fill="var(--warning-soft)" />
        <path d="M186 180v32M170 196h32" />
        <rect x="278" y="180" width="32" height="32" rx="2" fill="var(--warning-soft)" />
        <path d="M294 180v32M278 196h32" />
        <circle cx="240" cy="140" r="12" fill="var(--warning-soft)" />
        {/* Smoke */}
        <path d="M301 58c-8-8 8-14 0-22s8-14 0-22" opacity="0.4" />
      </g>
      <circle cx="400" cy="70" r="20" fill="var(--highlight)" opacity="0.85" />
    </svg>
  );
}
