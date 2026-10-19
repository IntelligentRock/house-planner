/** Mirrors private.normalize_invite_code(): uppercase, letters and digits only. */
export function normalizeInviteCode(code: string) {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Shape check before calling the server. Real validation happens in the database. */
export function looksLikeInviteCode(code: string) {
  return /^[A-Z0-9]{12}$/.test(normalizeInviteCode(code));
}

/** "abcd efgh ijkl" -> "ABCD-EFGH-IJKL" */
export function formatInviteCode(code: string) {
  const n = normalizeInviteCode(code).slice(0, 12);
  return n.match(/.{1,4}/g)?.join("-") ?? "";
}
