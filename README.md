# Family House Booking

A private booking calendar for a shared family house. Invited family members sign in with a passwordless email link, see who is staying when, and book, edit or cancel their own stays. Overlapping bookings are impossible — the database itself rejects them.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Supabase (Postgres, Auth, Realtime) · Vercel. Everything fits the free tiers.

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [Local development](#local-development)
4. [Setting up Supabase (production)](#setting-up-supabase-production)
5. [Deploying to Vercel](#deploying-to-vercel)
6. [Creating the first administrator](#creating-the-first-administrator)
7. [Inviting family members](#inviting-family-members)
8. [Backups and exporting bookings](#backups-and-exporting-bookings)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Known limitations](#known-limitations)

---

## Features

- **Calendar dashboard**: month, week and agenda views, Monday-first weeks, Dutch date/time conventions (24-hour clock, day-month order), always in `Europe/Amsterdam`. Multi-day stays draw as bars with the member's avatar, name and colour. Past days are hatched and today is marked. On phones, the month view becomes a compact grid with a day list, and the week view becomes an agenda.
- **House status at a glance**: who is there right now, the next reservation, when the house is next free (and for how long), and your own next stay. All of it is computed from real bookings.
- **Bookings**: overnight stays and short visits, with a live summary of the interval, field-level validation and a confirm step. When a request conflicts, the form says whose booking is in the way and offers "Start after it" with one click. Edits use optimistic concurrency, so a stale form never overwrites someone else's change.
- **Invitation-only enrolment**: enter a code, receive a magic link (or a 6-digit code), pick a name and an avatar. After that, members sign in with just their email.
- **Members and admin**: a members directory; admins can invite people, revoke codes, change roles, remove or restore access, and edit or cancel any booking.
- **Profiles**: 18 illustrated preset avatars (DiceBear "Notionists", CC0) and 10 calendar colours. Each member gets the least-used colour automatically and can change it.
- **Live updates**: open calendars refresh when anyone changes a booking (Supabase Realtime).
- **Accessibility**: labelled forms, keyboard support, focus-trapped dialogs (a bottom sheet on phones), confirmation for every destructive action, `aria-live` feedback, and information that never relies on colour alone.

## How it works

### Security model

The security boundary is **Postgres Row Level Security**, not the UI. Everything below is enforced in the database (`supabase/migrations/20261017000000_init.sql`) and covered by tests in `tests/db/`.

| Rule | How it is enforced |
| --- | --- |
| Only invited people get access | A signed-up account with no row in `profiles` can read nothing. Every policy requires `private.is_active_member()`. |
| Profiles come only from invitations | No `INSERT` privilege on `profiles`. The only way in is `redeem_invitation()`, a `SECURITY DEFINER` function. |
| Codes are single-use and race-safe | `redeem_invitation()` locks the invitation row `FOR UPDATE`, so concurrent redemptions serialise and only one succeeds. |
| Codes are never stored in plaintext | Only `sha256(normalised code)` is stored, plus the last four characters as a hint. The plaintext is shown once. The hash column is not even selectable by admins. |
| No self-promotion | Members have column-level `UPDATE` only on `display_name`, `avatar` and `color`. Role and status change only through `admin_update_member()`, which checks the caller is an admin and refuses to change the caller's own row. |
| Bookings are owned by the author | `user_id` defaults to `auth.uid()`, clients have no privilege to set it, and a trigger makes it immutable. |
| Owners or admins edit bookings | RLS `UPDATE` policy. Nobody can `DELETE` (cancelling is a status change that records who and when). |
| No double bookings | `EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE status = 'confirmed'`. The ranges are half-open, so 11:00 check-out and 11:00 check-in are fine. The rule holds under concurrent requests. |
| Lost updates are detected | Every booking has a `version`. Edits and cancellations only apply when the version still matches. |
| No secrets in the browser | The browser only has the publishable key. The web app never uses the secret key; only the operator scripts in `scripts/` do. |

Server Actions (`src/lib/actions/`) re-establish the user from the verified session on every call, validate input with Zod, and then write through the **user's own** Supabase client, so RLS applies to them too. The proxy (`src/proxy.ts`) only refreshes sessions and redirects signed-out visitors as a convenience.

### Time zones

Bookings are stored as `timestamptz` (absolute instants). The form takes Amsterdam wall-clock dates and times and converts them with `localToUtc()` in `src/lib/time.ts`, which does not depend on the server's or browser's time zone (tests run with the host clock set to UTC+14 and UTC−11):

- Times skipped by the spring-forward change (02:00–02:59 on the last Sunday of March) are **rejected** with an explanation.
- Times repeated by the autumn change resolve to the **first** occurrence (summer time).

### Project layout

```
src/
  app/(auth)/        welcome (invitation code), sign-in, onboarding, revoked
  app/(app)/         calendar dashboard, bookings, members, invitations, settings
  app/auth/callback  magic-link landing (PKCE code or token_hash)
  components/        calendar, booking dialogs, shell, shared UI (components/ui = shadcn)
  lib/               auth (data access layer), data queries, actions, time, validation
  proxy.ts           session refresh + signed-out redirect
supabase/
  migrations/        schema, RLS policies, functions
  templates/         sign-in email templates
scripts/             admin bootstrap, booking export, avatar generator
tests/db/            database tests against a local Supabase (RLS, constraints, races)
e2e/                 Playwright end-to-end tests
```

---

## Local development

**Requirements:** Node.js 20.9+ (tested on 24), Docker Desktop (running), npm.

```bash
npm install
npm run db:start            # starts Postgres, Auth, Realtime and Mailpit in Docker; applies migrations
npx supabase status         # shows the local URL and keys
cp .env.example .env.local  # then fill in the values from `supabase status`:
                            #   NEXT_PUBLIC_SUPABASE_URL             = API_URL (http://127.0.0.1:54321)
                            #   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY
                            #   SUPABASE_SECRET_KEY                  = SECRET_KEY
npm run admin:invite        # prints a one-time ADMIN invitation code
npm run dev                 # http://localhost:3000
```

Open <http://localhost:3000>, enter the code and your email. Local emails are not really sent: open **Mailpit** at <http://127.0.0.1:54324> to click the link or copy the code.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app |
| `npm run db:start` / `db:stop` | Start or stop local Supabase |
| `npm run db:reset` | Recreate the local database from migrations (deletes local data) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (run in three host time zones) |
| `npm run test:db` | Database security and constraint tests (needs `db:start`) |
| `npm run test:e2e` | Playwright end-to-end tests (needs `db:start`; starts `npm run dev` if needed) |
| `npm run build` | Production build |

---

## Setting up Supabase (production)

1. **Create a project** at <https://supabase.com/dashboard> (free plan). Choose a region close to the Netherlands (e.g. *Central EU (Frankfurt)*) and save the database password somewhere safe.

2. **Apply the schema.** Either:
   - **CLI (recommended):**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>   # the ref is in the dashboard URL
     npm run db:push
     ```
   - **or** open *SQL Editor*, paste the contents of `supabase/migrations/20261017000000_init.sql`, and run it once.

3. **Get the keys:** *Project Settings → API Keys*. Copy the **Project URL**, the **publishable key** (`sb_publishable_…`, or the legacy `anon` key) and, for the operator scripts only, a **secret key** (`sb_secret_…`, or the legacy `service_role` key).

4. **Configure Auth URLs:** *Authentication → URL Configuration*
   - **Site URL:** `https://<your-app>.vercel.app` (or your own domain)
   - **Redirect URLs:** add
     - `https://<your-app>.vercel.app/**`
     - `http://localhost:3000/**` (if you also run locally against this project)
     - optionally `https://*-<your-vercel-team>.vercel.app/**` for preview deployments

5. **Configure email sign-in:** *Authentication → Sign In / Providers → Email*
   - Keep **Email** enabled and **Confirm email** on.
   - Optionally turn off "Allow new users to sign up". The app already only creates accounts for visitors holding a valid invitation, and accounts without an invitation can't see anything anyway. **But** if you turn sign-ups off, invited people can't create their accounts either, so leave it on.

6. **Email templates (recommended):** *Authentication → Emails → Templates*. Paste:
   - `supabase/templates/magic_link.html` into **Magic Link**
   - `supabase/templates/confirmation.html` into **Confirm signup**

   These links work even when the email is opened in a different browser or app, and they include the one-time code. Without them, the default links only work in the browser that requested them, but the default emails still contain a working link.

7. **Set up SMTP (needed for real use):** Supabase's built-in email service is for testing only. It sends a handful of emails per hour and only to your project's team members. Under *Project Settings → Authentication → SMTP Settings*, connect a free-tier provider (e.g. Resend, Brevo, or Postmark's trial) using a sender address on a domain you control. Afterwards you can raise the email rate limit under *Authentication → Rate Limits*.

> **Free-plan note:** Supabase pauses free projects after about a week without activity. Regular family use keeps it awake. If it pauses, resume it from the dashboard; no data is lost.

## Deploying to Vercel

1. Push this repository to GitHub, GitLab or Bitbucket.
2. In Vercel: **Add New → Project → Import** the repository. The framework (Next.js) is detected automatically.
3. Add **Environment Variables** (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable (or anon) key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app`. Set this for Production only and leave it out for Preview, so preview links point at the preview. |
   | `NEXT_PUBLIC_HOUSE_NAME` | e.g. `Huize Zonnehoek` |

   Do **not** add `SUPABASE_SECRET_KEY` to Vercel. The app doesn't use it.
4. **Deploy.** Then make sure the deployed URL matches the Site URL and redirect URLs from step 4 above.

With the Vercel CLI instead: `npm i -g vercel`, then `vercel link`, `vercel env add …`, `vercel --prod`.

## Creating the first administrator

New accounts are never made administrators automatically. Bootstrapping needs the secret key or database access, which only the project owner has.

**Option A, from your computer** (keep the secret key local and never commit it):

```bash
# .env.local (or another file passed with --env-file) pointing at the PRODUCTION project:
#   NEXT_PUBLIC_SUPABASE_URL=...  SUPABASE_SECRET_KEY=...  NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app
npm run admin:invite
```

**Option B, Supabase dashboard:** in *SQL Editor*, run

```sql
select * from public.bootstrap_admin_invitation('Initial administrator');
```

Both print a single-use **administrator** invitation code, valid for 7 days. Open `https://<your-app>/welcome`, enter it, sign in with your email and choose your name and avatar. You are now the administrator.

To promote someone who has **already joined**, use `npm run admin:promote -- person@example.com`, or `select public.bootstrap_promote_admin('person@example.com');` in the SQL editor. Once one admin exists, they can promote others from the **Members** page.

These bootstrap functions can't be called by app users. Execute permission is granted only to the service role.

## Inviting family members

As an administrator, open **Invitations** in the sidebar:

1. Add a note ("Cousin Sam"), an expiry (1 day to never) and how many times the code may be used (default once), and choose whether the person joins as a member or an administrator.
2. **Create invitation code.** The code (e.g. `K7QM-2XRP-H9TD`) and a ready-to-send message are shown **once**. Copy and send them.
3. The person opens `/welcome`, enters the code, confirms their email and picks a name and avatar. The code is consumed at that moment.

Revoke an unused code with **Revoke**. To remove someone's access, use **Members → ⋯ → Remove access**. Their sessions immediately stop seeing data. Their bookings stay; cancel them separately if needed. To delete an account completely, delete the user under *Authentication → Users* in Supabase (their profile and bookings are removed with it).

If no admin can sign in, `npm run admin:invite -- --member "Name"` creates a member code from the command line.

## Backups and exporting bookings

- **CSV/JSON export:** `npm run export:bookings` writes `backups/bookings-<timestamp>.csv` and `.json` with all bookings (including cancelled ones), member names and emails, and times in both Amsterdam local time and UTC. It uses `SUPABASE_SECRET_KEY` from `.env.local`. The CSV opens directly in Excel or Numbers.
- **Full database dump:**
  ```bash
  npx supabase db dump --linked -f backup-schema.sql
  npx supabase db dump --linked --data-only -f backup-data.sql
  ```
- Free Supabase projects don't come with downloadable backups. Export regularly, e.g. monthly or before major changes.

## Testing

```bash
npm run lint && npm run typecheck
npm test              # unit: timezone/DST conversion, validation, availability, calendar layout, error mapping
npm run db:start
npm run test:db       # database: RLS, invitations, constraints, races (uses only the local stack)
npm run test:e2e      # browser: full enrolment → booking → conflict → admin → sign-out flow
```

The database tests talk to the local stack only. They read connection details from `supabase status` and refuse non-local URLs. They cover:

- valid, invalid, expired, revoked and used codes; single-use and multi-use limits; **8 concurrent redemptions of one code → exactly 1 succeeds**
- outsiders (signed up without an invitation) and anonymous visitors see nothing and can write nothing
- members can't self-promote, edit other profiles, forge owners, statuses or versions, edit or cancel others' bookings, delete rows, or call admin functions
- admins can manage roles and access but not their own; revoking access cuts off data immediately
- overlap rejected, adjacency accepted, cancelled time is re-bookable, **8 concurrent overlapping inserts → exactly 1 succeeds**, edits into overlaps rejected, stale versions detected
- DST: stays across the October change keep correct instants, and adjacency across the March change works

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Missing NEXT_PUBLIC_SUPABASE_URL…" | Create `.env.local` from `.env.example` (locally), or add the variables in Vercel and redeploy. |
| Sign-in email never arrives | Locally, check Mailpit at <http://127.0.0.1:54324>. In production, configure custom SMTP (the built-in service only emails team members, a few per hour) and check spam. |
| "Too many sign-in emails were requested" | Supabase rate limit. Wait a minute, or raise it under *Authentication → Rate Limits* once SMTP is set up. |
| Link opens but says it expired or was already used | Links are single-use and last an hour, and some email scanners "click" links in advance. Enter the **6-digit code** from the email instead, or request a new email. |
| "Open the sign-in link in the same browser…" | You're using the default email template (PKCE link). Enter the code, or install the templates from `supabase/templates/`. |
| Link redirects to `localhost` or the wrong domain | Fix **Site URL** and **Redirect URLs** in Supabase (*Authentication → URL Configuration*) and `NEXT_PUBLIC_SITE_URL` in Vercel. |
| "We couldn't find an account for that email" | That email hasn't joined yet. Enter the invitation code on `/welcome` first. |
| Signed in but sent to "Set up your profile" | The account hasn't redeemed an invitation. Enter a valid code there. |
| "Your access has been paused" | An admin removed access. Another admin can restore it under **Members**. |
| `npm run db:start` fails | Start Docker Desktop first. |
| `npm run test:db` says Supabase is not running | `npm run db:start` |
| Migration fails on `db push` | Make sure the project is linked (`npx supabase link`) and that you didn't already run the SQL by hand. |

## Known limitations

- **English only** for now; strings live in the components. Dates use English month names in Dutch order.
- **No booking notifications** (email on new or cancelled bookings). The calendar updates live instead.
- **Preset avatars only**; no uploads.
- **Light theme only.**
- **No recurring bookings, waitlists or approval flow.** It is first come, first served.
- In the October DST overlap, an ambiguous wall-clock time (e.g. 02:30) is interpreted as the first occurrence (summer time).
- The sign-in form says when an email has no account (to guide people to the invitation page). For a private family app this is a deliberate usability trade-off.
- Removing someone's access doesn't delete their Supabase Auth account. Do that in the dashboard if needed.
