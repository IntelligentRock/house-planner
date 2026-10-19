#!/usr/bin/env node
// Operator commands that need the Supabase secret (service-role) key.
// Run them on your own machine only; the key never goes to the browser.
//
//   npm run admin:invite                        # one-time code that enrols an ADMINISTRATOR (first admin)
//   npm run admin:invite -- --member "Aunt Jo"  # member code, if no admin can log in to create one
//   npm run admin:promote -- someone@example.com
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment
// or from .env.local / .env (pass --env-file <path> to choose another file).
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const args = process.argv.slice(2);
const command = args.shift();

const envFileIndex = args.indexOf("--env-file");
const envFiles = envFileIndex >= 0 ? [args.splice(envFileIndex, 2)[1]] : [".env.local", ".env"];
for (const file of envFiles) if (existsSync(file)) dotenv.config({ path: file, quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (see .env.example).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

async function invite() {
  const memberIndex = args.indexOf("--member");
  if (memberIndex >= 0) {
    const label = args[memberIndex + 1] ?? "Member invite";
    // Service role bypasses RLS: insert a hashed member code directly.
    const { createHash, randomInt } = await import("node:crypto");
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const raw = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
    const code = raw.match(/.{4}/g).join("-");
    const { error } = await supabase.from("invitations").insert({
      code_hash: `\\x${createHash("sha256").update(raw).digest("hex")}`,
      code_hint: raw.slice(-4),
      label,
      role: "member",
      max_uses: 1,
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    });
    if (error) throw error;
    print(code, "member", "14 days");
    return;
  }

  const { data, error } = await supabase.rpc("bootstrap_admin_invitation", { p_label: "Administrator (CLI)" });
  if (error) throw error;
  print(data[0].code, "ADMINISTRATOR", "7 days");
}

function print(code, role, validity) {
  console.log(`\nInvitation code (${role}, single use, valid ${validity}):\n\n    ${code}\n`);
  console.log(`Open ${siteUrl}/welcome, enter the code and sign in with your email.`);
  console.log("This code is shown once and is stored only as a hash.\n");
}

async function promote() {
  const email = args[0];
  if (!email) throw new Error("Usage: npm run admin:promote -- someone@example.com");
  const { data, error } = await supabase.rpc("bootstrap_promote_admin", { p_email: email });
  if (error) throw new Error(error.hint ? `${error.message}: ${error.hint}` : error.message);
  console.log(`${data.display_name} <${data.email}> is now an administrator.`);
}

try {
  if (command === "invite") await invite();
  else if (command === "promote") await promote();
  else {
    console.error("Usage: node scripts/admin.mjs <invite [--member label] | promote email>");
    process.exit(1);
  }
} catch (error) {
  console.error(`Failed: ${error.message ?? error}`);
  process.exit(1);
}
