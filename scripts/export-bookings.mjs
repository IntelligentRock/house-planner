#!/usr/bin/env node
// Exports all bookings (including cancelled ones) with member names to CSV and JSON.
//
//   npm run export:bookings                 # writes ./backups/bookings-<timestamp>.{csv,json}
//   npm run export:bookings -- --out ./dir
//
// Uses the secret key from .env.local / .env, like scripts/admin.mjs.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

for (const file of [".env.local", ".env"]) if (existsSync(file)) dotenv.config({ path: file, quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (see .env.example).");
  process.exit(1);
}

const outIndex = process.argv.indexOf("--out");
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : "backups";

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, title, notes, starts_at, ends_at, status, created_at, updated_at, cancelled_at, member:profiles!bookings_user_id_fkey(display_name, email)")
    .order("starts_at")
    .range(from, from + 999);
  if (error) {
    console.error(`Export failed: ${error.message}`);
    process.exit(1);
  }
  rows.push(...data);
  if (data.length < 1000) break;
}

const amsterdam = (iso) =>
  iso ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "";

const columns = ["id", "title", "member", "email", "start_amsterdam", "end_amsterdam", "starts_at_utc", "ends_at_utc", "status", "notes", "created_at", "cancelled_at"];
const csvValue = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const csv = [
  columns.join(","),
  ...rows.map((r) =>
    [r.id, r.title, r.member?.display_name, r.member?.email, amsterdam(r.starts_at), amsterdam(r.ends_at), r.starts_at, r.ends_at, r.status, r.notes, r.created_at, r.cancelled_at]
      .map(csvValue)
      .join(","),
  ),
].join("\r\n");

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const base = path.join(outDir, `bookings-${stamp}`);
writeFileSync(`${base}.csv`, "﻿" + csv); // BOM so Excel reads UTF-8
writeFileSync(`${base}.json`, JSON.stringify(rows, null, 2));
console.log(`Exported ${rows.length} bookings to ${base}.csv and ${base}.json`);
