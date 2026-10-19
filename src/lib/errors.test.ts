import { describe, expect, it } from "vitest";
import { dbErrorCode, friendlyAuthError, friendlyDbError } from "./errors";
import { formatInviteCode, looksLikeInviteCode, normalizeInviteCode } from "./invitations";

describe("database error mapping", () => {
  it("recognises exclusion violations as booking conflicts", () => {
    expect(dbErrorCode({ code: "23P01", message: "conflicting key value violates exclusion constraint" })).toBe(
      "BOOKING_CONFLICT",
    );
  });

  it("maps raised application codes to friendly messages", () => {
    expect(friendlyDbError({ code: "P0001", message: "INVITATION_USED" })).toMatch(/already been used/);
    expect(friendlyDbError({ code: "P0001", message: "BOOKING_ALREADY_ENDED" })).toMatch(/already ended/);
    expect(friendlyDbError({ code: "42501", message: "permission denied for table bookings" })).toMatch(/permission/);
  });

  it("never leaks raw database messages", () => {
    expect(friendlyDbError({ code: "XX000", message: "internal: relation secret_table" })).not.toMatch(/secret/);
    expect(friendlyDbError({ code: "P0001", message: "NOT_A_KNOWN_CODE" })).not.toMatch(/NOT_A_KNOWN/);
  });

  it("maps auth errors", () => {
    expect(friendlyAuthError("otp_expired")).toMatch(/expired/);
    expect(friendlyAuthError(undefined, "Signups not allowed for otp")).toMatch(/invitation code/);
    // A mistyped one-time code is about the code, not the link.
    expect(friendlyAuthError("token_invalid", "Token has expired or is invalid")).toMatch(/code isn't valid/);
  });
});

describe("invitation code helpers", () => {
  it("normalises and formats codes", () => {
    expect(normalizeInviteCode(" abcd-efgh ijkl ")).toBe("ABCDEFGHIJKL");
    expect(formatInviteCode("abcdefghijkl")).toBe("ABCD-EFGH-IJKL");
    expect(looksLikeInviteCode("abcd efgh jklm")).toBe(true);
    expect(looksLikeInviteCode("abc")).toBe(false);
  });
});
