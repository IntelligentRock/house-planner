import { expect, test } from "@playwright/test";
import { adminInviteCode, clearInbox, emailCode, enrol, uniqueEmail } from "./helpers";

const SHOTS = process.env.SCREENSHOT_DIR;
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

test("signed-out visitors are sent to the welcome page", async ({ page }) => {
  for (const path of ["/calendar", "/members", "/invitations", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/welcome$/);
  }
  await shot(page, "01-welcome");
});

test("an invalid invitation code is rejected", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByLabel("Invitation code").fill("AAAA-BBBB-CCCC");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/isn't valid, has expired or has already been used/)).toBeVisible();
});

test("unknown emails cannot sign up without an invitation", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(uniqueEmail("stranger"));
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/couldn't find an account/i)).toBeVisible();
});

test("admin enrols, books, edits, cancels, invites a member who hits a conflict", async ({ browser }) => {
  // --- Administrator enrols with a CLI bootstrap code
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const adminEmail = uniqueEmail("admin");
  await enrol(admin, { code: adminInviteCode(), email: adminEmail, name: "Ada Admin" });
  await expect(admin.getByText(/Welcome, Ada Admin/)).toBeVisible();
  await shot(admin, "02-calendar-empty");

  // --- Create a booking through the dialog (defaults: overnight stay)
  await admin.getByRole("button", { name: "New booking" }).first().click();
  const dialog = admin.getByRole("dialog");
  await expect(dialog.getByText("Booking as")).toBeVisible();
  await dialog.getByLabel("Title", { exact: true }).fill("Autumn weekend");
  await dialog.getByLabel("Notes").fill("Bringing the dog.");
  await shot(admin, "03-new-booking");
  await dialog.getByRole("button", { name: "Confirm booking" }).click();
  await expect(admin.getByText("Booking confirmed")).toBeVisible();
  await expect(dialog).toBeHidden();

  // It appears immediately on the calendar and in the upcoming panel.
  const bar = admin.getByRole("button", { name: /Autumn weekend, booked by Ada Admin/ }).first();
  await expect(bar).toBeVisible();

  // --- Open details, edit the title
  await bar.click();
  await expect(admin.getByRole("dialog").getByText("Bringing the dog.")).toBeVisible();
  await shot(admin, "04-booking-details");
  await admin.getByRole("button", { name: "Edit" }).click();
  await admin.getByRole("dialog").getByLabel("Title", { exact: true }).fill("Long autumn weekend");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByText("Booking updated")).toBeVisible();
  await expect(admin.getByRole("button", { name: /Long autumn weekend, booked by Ada Admin/ }).first()).toBeVisible();

  // --- Admin creates a member invitation in the UI
  await admin.goto("/invitations");
  const inviteLabel = `Cousin Max ${Date.now()}`;
  await admin.getByLabel("Who is it for?").fill(inviteLabel);
  await admin.getByRole("button", { name: "Create invitation code" }).click();
  const codeText = await admin.getByRole("dialog").locator("code").first().textContent();
  const memberCode = codeText!.trim();
  expect(memberCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await shot(admin, "05-invitation-created");
  await admin.getByRole("button", { name: "Done" }).click();
  await expect(admin.getByText(inviteLabel)).toBeVisible();

  // --- Member enrols in a separate browser
  const memberCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const member = await memberCtx.newPage();
  await enrol(member, { code: memberCode, email: uniqueEmail("max"), name: "Max" });
  await shot(member, "06-mobile-calendar");

  // The same code no longer works.
  const thirdCtx = await browser.newContext();
  const third = await thirdCtx.newPage();
  await third.goto("/welcome");
  await third.getByLabel("Invitation code").fill(memberCode);
  await third.getByRole("button", { name: "Continue" }).click();
  await expect(third.getByText(/already been used/)).toBeVisible();
  await thirdCtx.close();

  // --- Member tries to book the same (default) slot: conflict, nothing saved
  await member.getByRole("button", { name: "New booking" }).click();
  const mdialog = member.getByRole("dialog");
  await mdialog.getByLabel("Title", { exact: true }).fill("Max's visit");
  await mdialog.getByRole("button", { name: "Confirm booking" }).click();
  await expect(mdialog.getByText(/Ada Admin has already booked part of that time/)).toBeVisible();
  await expect(mdialog.getByText(/Long autumn weekend/)).toBeVisible();
  await shot(member, "07-mobile-conflict");

  // "Start after it" moves the stay to the first free moment, which then saves.
  await mdialog.getByRole("button", { name: /Start after it/ }).click();
  await mdialog.getByRole("button", { name: "Confirm booking" }).click();
  await expect(member.getByText("Booking confirmed")).toBeVisible();

  // --- Member cannot manage the admin's booking and sees no admin UI
  await member.goto("/bookings");
  await member.getByRole("button", { name: /Long autumn weekend/ }).click();
  await expect(member.getByText(/Only Ada Admin or an administrator can change this booking/)).toBeVisible();
  await expect(member.getByRole("dialog").getByRole("button", { name: "Edit" })).toHaveCount(0);
  await member.keyboard.press("Escape");
  await member.goto("/invitations");
  await expect(member).toHaveURL(/\/calendar/);

  // --- Admin sees the member's booking live, and can cancel it (with confirmation)
  await admin.goto("/calendar?view=agenda");
  await admin.getByRole("button", { name: /Max's visit/ }).first().click();
  await expect(admin.getByRole("dialog").getByText(/Booked by/)).toBeVisible();
  await admin.getByRole("button", { name: "Cancel booking" }).click();
  await expect(admin.getByRole("alertdialog")).toBeVisible();
  await shot(admin, "08-cancel-confirm");
  await admin.getByRole("alertdialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(admin.getByText("Booking cancelled")).toBeVisible();
  await expect(admin.getByRole("button", { name: /Max's visit/ })).toHaveCount(0);

  await admin.goto("/calendar?view=week");
  await shot(admin, "09-week");
  await admin.goto("/members");
  await shot(admin, "10-members");
  await admin.goto("/settings");
  await shot(admin, "11-settings");

  // --- Sign out, then sign back in without an invitation code
  await admin.goto("/calendar");
  await admin.getByRole("button", { name: "Ada Admin Administrator" }).click();
  await admin.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(admin).toHaveURL(/\/sign-in/);
  await admin.getByLabel("Email address").fill(adminEmail);
  await clearInbox(adminEmail);
  await admin.getByRole("button", { name: "Email me a sign-in link" }).click();
  await admin.getByLabel("Code from the email").fill(await emailCode(adminEmail));
  await admin.getByRole("button", { name: "Continue" }).click();
  await expect(admin).toHaveURL(/\/calendar/);

  await adminCtx.close();
  await memberCtx.close();
});
