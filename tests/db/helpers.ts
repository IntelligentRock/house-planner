import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Database tests talk to the *local* Supabase stack only. Connection details
 * come from `supabase status`, never from .env files, so a misconfigured
 * environment can't point these tests (which create users) at production.
 */
function loadLocalStack() {
  let raw: string;
  try {
    raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("Local Supabase is not running. Start it with `npm run db:start`.");
  }
  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  const url: string = status.API_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Refusing to run database tests against non-local URL ${url}`);
  }
  return {
    url,
    publishableKey: (status.PUBLISHABLE_KEY ?? status.ANON_KEY) as string,
    secretKey: (status.SECRET_KEY ?? status.SERVICE_ROLE_KEY) as string,
  };
}

export const stack = loadLocalStack();

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Service-role client: bypasses RLS. Only for test setup and inspection. */
export const service = createClient(stack.url, stack.secretKey, clientOptions);

/** Unauthenticated client, as any visitor on the internet would have. */
export function anonClient() {
  return createClient(stack.url, stack.publishableKey, clientOptions);
}

export type TestUser = { id: string; email: string; client: SupabaseClient };

/** Creates an auth account (not yet a member) and returns a signed-in client. */
export async function createUser(prefix = "user"): Promise<TestUser> {
  const email = `${prefix}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

/** Generates an admin invitation through the operator bootstrap function. */
export async function bootstrapAdminCode() {
  const { data, error } = await service.rpc("bootstrap_admin_invitation", { p_label: "test" });
  if (error) throw error;
  return (data as { id: string; code: string }[])[0];
}

export async function redeem(user: TestUser, code: string, name = "Test Member") {
  return user.client.rpc("redeem_invitation", {
    p_code: code,
    p_display_name: name,
    p_avatar: "avatar-03",
  });
}

/** A fully enrolled administrator. */
export async function createAdmin(): Promise<TestUser> {
  const user = await createUser("admin");
  const { code } = await bootstrapAdminCode();
  const { error } = await redeem(user, code, "Test Admin");
  if (error) throw error;
  return user;
}

/** Creates a member invitation as `admin` and returns the plaintext code. */
export async function inviteCode(
  admin: TestUser,
  opts: { maxUses?: number; expiresAt?: string | null; label?: string } = {},
) {
  const { data, error } = await admin.client.rpc("create_invitation", {
    p_label: opts.label ?? "test invite",
    p_role: "member",
    p_max_uses: opts.maxUses ?? 1,
    p_expires_at: opts.expiresAt ?? null,
  });
  if (error) throw error;
  return (data as { id: string; code: string }[])[0];
}

/** A fully enrolled regular member. */
export async function createMember(admin: TestUser, name = "Test Member"): Promise<TestUser> {
  const user = await createUser("member");
  const { code } = await inviteCode(admin);
  const { error } = await redeem(user, code, name);
  if (error) throw error;
  return user;
}

/** Removes all bookings so tests start from an empty calendar. */
export async function clearBookings() {
  const { error } = await service.from("bookings").delete().not("id", "is", null);
  if (error) throw error;
}

const HOUR = 3_600_000;

/** ISO interval starting `startHours` from a base time far enough ahead to be "future". */
export function slot(base: Date, startHours: number, durationHours: number) {
  const start = new Date(base.getTime() + startHours * HOUR);
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + durationHours * HOUR).toISOString(),
  };
}

/** A whole-hour base time a few days from now. */
export function futureBase(daysAhead = 7) {
  const d = new Date(Date.now() + daysAhead * 24 * HOUR);
  d.setUTCMinutes(0, 0, 0);
  return d;
}
