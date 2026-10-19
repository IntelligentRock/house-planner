import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54324";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
}

/** Admin bootstrap code from the operator CLI (uses the local secret key). */
export function adminInviteCode() {
  const out = execSync("node scripts/admin.mjs invite", { encoding: "utf8" });
  const match = out.match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  if (!match) throw new Error(`No code in output:\n${out}`);
  return match[0];
}

/** Deletes earlier emails to `email`, so the next lookup can't return a stale code. */
export async function clearInbox(email: string) {
  await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`, { method: "DELETE" });
}

/** Polls the local Mailpit inbox for the newest sign-in email to `email`. */
export async function latestEmail(email: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const body = (await res.json()) as { messages: { ID: string }[] };
    if (body.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${body.messages[0].ID}`)).json();
      return { html: msg.HTML as string, text: msg.Text as string };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email arrived for ${email}`);
}

export async function emailCode(email: string) {
  const { text, html } = await latestEmail(email);
  const code = (text || html).match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error("No one-time code in email");
  return code;
}

/** Full enrolment through the UI: invitation code -> email -> code -> profile. */
export async function enrol(page: Page, { code, email, name }: { code: string; email: string; name: string }) {
  await page.goto("/welcome");
  await page.getByLabel("Invitation code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Invitation code accepted.")).toBeVisible();

  await page.getByLabel("Email address").fill(email);
  await clearInbox(email);
  await page.getByRole("button", { name: "Send my sign-in link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();

  await page.getByLabel("Code from the email").fill(await emailCode(email));
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Display name").fill(name);
  await page.getByText("Avatar 5").locator("..").click();
  await page.getByRole("button", { name: "Join the house" }).click();
  await expect(page).toHaveURL(/\/calendar/);
}
