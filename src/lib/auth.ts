import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Data Access Layer: the one place that works out who is making a request.
 * Identity comes from the verified session (getClaims), never from input.
 * Memoised per request with React `cache`.
 */
export const getViewer = cache(async () => {
  // Sessions are per request and token checks read the clock, so never prerender this.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { supabase, user: null, profile: null } as const;

  const email = (data.claims.email as string | undefined) ?? "";
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>();
  return { supabase, user: { id: userId, email }, profile: profile ?? null } as const;
});

/** For pages: an active member, or a redirect to wherever they belong. */
export async function requireMember() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/welcome");
  if (!viewer.profile) redirect("/onboarding");
  if (viewer.profile.status !== "active") redirect("/revoked");
  return { supabase: viewer.supabase, user: viewer.user, profile: viewer.profile };
}

export async function requireAdmin() {
  const ctx = await requireMember();
  if (ctx.profile.role !== "admin") redirect("/calendar");
  return ctx;
}

/** For Server Actions: like requireMember, but returns null instead of redirecting. */
export async function getMemberContext() {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile || viewer.profile.status !== "active") return null;
  return { supabase: viewer.supabase, user: viewer.user, profile: viewer.profile };
}

/** Where a signed-in visitor should land, given their enrolment state. */
export function homeFor(viewer: Awaited<ReturnType<typeof getViewer>>) {
  if (!viewer.user) return "/welcome";
  if (!viewer.profile) return "/onboarding";
  if (viewer.profile.status !== "active") return "/revoked";
  return "/calendar";
}
