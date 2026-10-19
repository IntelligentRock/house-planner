import { beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  bootstrapAdminCode,
  createAdmin,
  createMember,
  createUser,
  inviteCode,
  redeem,
  service,
  type TestUser,
} from "./helpers";

let admin: TestUser;

beforeAll(async () => {
  admin = await createAdmin();
});

describe("invitation codes", () => {
  it("are generated in the expected format and stored only as a hash", async () => {
    const { id, code } = await inviteCode(admin);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);

    const { data: row } = await service.from("invitations").select("*").eq("id", id).single();
    expect(row).toBeTruthy();
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain(code);
    expect(serialized).not.toContain(code.replaceAll("-", ""));
    expect(row!.code_hint).toBe(code.replaceAll("-", "").slice(-4));
  });

  it("can be checked by anonymous visitors without revealing anything else", async () => {
    const { code } = await inviteCode(admin);
    const anon = anonClient();
    expect((await anon.rpc("check_invitation", { p_code: code })).data).toBe(true);
    expect((await anon.rpc("check_invitation", { p_code: "AAAA-BBBB-CCCC" })).data).toBe(false);
    expect((await anon.rpc("check_invitation", { p_code: "" })).data).toBe(false);
    // But the table itself is not readable.
    const { data, error } = await anon.from("invitations").select("id");
    expect(error ?? data?.length === 0).toBeTruthy();
  });

  it("redeem with a valid code, ignoring case, spaces and dashes", async () => {
    const { code } = await inviteCode(admin);
    const user = await createUser();
    const sloppy = ` ${code.toLowerCase().replaceAll("-", " ")} `;
    const { data, error } = await redeem(user, sloppy, "Grandma Jo");
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: user.id, email: user.email, display_name: "Grandma Jo", role: "member", status: "active" });
    expect(data.color).toBeTruthy();
  });

  it("reject an invalid code", async () => {
    const user = await createUser();
    const { error } = await redeem(user, "ZZZZ-ZZZZ-ZZZZ");
    expect(error?.message).toBe("INVITATION_INVALID");
    const { data: profile } = await service.from("profiles").select("id").eq("id", user.id);
    expect(profile).toEqual([]);
  });

  it("are single-use by default", async () => {
    const { code } = await inviteCode(admin);
    const first = await createUser();
    const second = await createUser();
    expect((await redeem(first, code)).error).toBeNull();
    expect((await redeem(second, code)).error?.message).toBe("INVITATION_USED");
    expect((await anonClient().rpc("check_invitation", { p_code: code })).data).toBe(false);
  });

  it("can be redeemed exactly once under concurrent attempts", async () => {
    const { id, code } = await inviteCode(admin);
    const users = await Promise.all(Array.from({ length: 8 }, () => createUser("race")));
    const results = await Promise.all(users.map((u) => redeem(u, code)));

    const successes = results.filter((r) => r.error === null);
    const failures = results.filter((r) => r.error !== null);
    expect(successes).toHaveLength(1);
    expect(failures.every((r) => r.error!.message === "INVITATION_USED")).toBe(true);

    const { data: inv } = await service.from("invitations").select("use_count").eq("id", id).single();
    expect(inv!.use_count).toBe(1);
    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("id", users.map((u) => u.id));
    expect(count).toBe(1);
  });

  it("respect a multi-use limit", async () => {
    const { code } = await inviteCode(admin, { maxUses: 2 });
    const [a, b, c] = await Promise.all([createUser(), createUser(), createUser()]);
    expect((await redeem(a, code)).error).toBeNull();
    expect((await redeem(b, code)).error).toBeNull();
    expect((await redeem(c, code)).error?.message).toBe("INVITATION_USED");
  });

  it("stop working once expired", async () => {
    const { id, code } = await inviteCode(admin, { expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    // Simulate the passage of time.
    await service.from("invitations").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", id);
    const user = await createUser();
    expect((await anonClient().rpc("check_invitation", { p_code: code })).data).toBe(false);
    expect((await redeem(user, code)).error?.message).toBe("INVITATION_EXPIRED");
  });

  it("cannot be created with an expiry in the past", async () => {
    const { error } = await admin.client.rpc("create_invitation", {
      p_expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(error?.message).toBe("INVITATION_EXPIRY_IN_PAST");
  });

  it("stop working once revoked", async () => {
    const { id, code } = await inviteCode(admin);
    expect((await admin.client.rpc("revoke_invitation", { p_invitation_id: id })).error).toBeNull();
    const user = await createUser();
    expect((await anonClient().rpc("check_invitation", { p_code: code })).data).toBe(false);
    expect((await redeem(user, code)).error?.message).toBe("INVITATION_REVOKED");
  });

  it("cannot give an existing member a second profile", async () => {
    const member = await createMember(admin);
    const { code } = await inviteCode(admin);
    expect((await redeem(member, code)).error?.message).toBe("ALREADY_ENROLLED");
    // The code was not consumed by the failed attempt.
    expect((await anonClient().rpc("check_invitation", { p_code: code })).data).toBe(true);
  });

  it("validate the profile details", async () => {
    const { code } = await inviteCode(admin);
    const user = await createUser();
    const bad = await user.client.rpc("redeem_invitation", { p_code: code, p_display_name: "  ", p_avatar: "avatar-01" });
    expect(bad.error?.message).toBe("PROFILE_INVALID");
    const badAvatar = await user.client.rpc("redeem_invitation", {
      p_code: code,
      p_display_name: "Ok",
      p_avatar: "https://evil.example/x.png",
    });
    expect(badAvatar.error?.message).toBe("PROFILE_INVALID");
    // Failed attempts roll back: the code still works.
    expect((await redeem(user, code)).error).toBeNull();
  });

  it("require a signed-in user to redeem", async () => {
    const { code } = await inviteCode(admin);
    const { error } = await anonClient().rpc("redeem_invitation", {
      p_code: code,
      p_display_name: "Anon",
      p_avatar: "avatar-01",
    });
    expect(error).not.toBeNull();
  });
});

describe("invitation management", () => {
  it("is limited to administrators", async () => {
    const member = await createMember(admin);
    const { id } = await inviteCode(admin);

    expect((await member.client.rpc("create_invitation", {})).error?.message).toBe("FORBIDDEN");
    expect((await member.client.rpc("revoke_invitation", { p_invitation_id: id })).error?.message).toBe("FORBIDDEN");
    expect((await member.client.from("invitations").select("id")).data).toEqual([]);

    const direct = await member.client
      .from("invitations")
      .insert({ code_hash: "\\x00", code_hint: "AAAA", role: "admin" });
    expect(direct.error).not.toBeNull();
  });

  it("lets admins list invitations but never read the hashes", async () => {
    const { id } = await inviteCode(admin, { label: "For cousin Sam" });
    const { data } = await admin.client.from("invitations").select("id, label, code_hint, use_count").eq("id", id);
    expect(data).toEqual([expect.objectContaining({ id, label: "For cousin Sam", use_count: 0 })]);
    const { error } = await admin.client.from("invitations").select("code_hash").eq("id", id);
    expect(error).not.toBeNull();
  });

  it("keeps the operator bootstrap functions away from app users", async () => {
    const member = await createMember(admin);
    for (const client of [anonClient(), member.client, admin.client]) {
      expect((await client.rpc("bootstrap_admin_invitation", {})).error).not.toBeNull();
      expect((await client.rpc("bootstrap_promote_admin", { p_email: member.email })).error).not.toBeNull();
    }
    const { data: profile } = await service.from("profiles").select("role").eq("id", member.id).single();
    expect(profile!.role).toBe("member");
  });

  it("admin bootstrap codes enrol an administrator", async () => {
    const { code } = await bootstrapAdminCode();
    const user = await createUser();
    const { data, error } = await redeem(user, code);
    expect(error).toBeNull();
    expect(data.role).toBe("admin");
  });
});
