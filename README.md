# CommunityConnect

**Connecting People. Solving Problems. Building Communities.**

A working Otukpo/Benue community-coordination MVP with moderated issue reporting,
volunteers, reviewed organizations, opportunities, skills, notices, belongings and
nonfinancial support. Independent React/TypeScript frontend, REST API, D1/SQLite
database, R2 photos, GitHub repository and hosted deployment.

## Run on Linux

Node 22.13+ and npm; no paid API or separate database server:

```sh
npm ci
npm run build:local
PORT=3103 npm run local
```

Open http://127.0.0.1:3103. The lightweight runner automatically applies schema
migrations and persists records in ignored .local-state/data.sqlite.
Sign-in uses a clearly documented loopback-only development account with local
moderator permission. Its HttpOnly/SameSite session is invalidated on sign-out.
Hosted identity comes from ChatGPT/Sites; do not expose the local mock login publicly.

## Working workflows

- Issue reports: title, category, description, optional sanitized-by-browser photo,
  approximate area and coordinates. Stored coordinates are rounded to 0.01 degrees.
- Submitted → awaiting-review → verified → acknowledged → in-progress → resolved
  → closed, plus rejection and explicit reopening. A review note is required.
- Pending reports are owner/moderator-only. Public reports omit owner IDs.
- Community action board, real record counts, search/LGA/category/status filters,
  attributed OSM map, followable issues and chronological status history.
- Account notifications for moderation, followed issue updates, volunteer
  participation and private coordination requests.
- Private volunteer interests/service-area profiles and idempotent activity joining.
- Reviewed organization registration. Only an approved organization's owner can
  submit its opportunities. Organizers can view their own volunteer registrations.
- Volunteer, job, apprenticeship, scholarship, training, internship, workshop and
  event categories, application instructions, optional deadlines and event dates.
- Volunteer registration is limited to appropriate activity categories and rejects
  expired deadlines. Joining shares a display name with the organizer.
- Skills offers/requests with category, general area and availability.
- Community notices and dated .ics calendar downloads.
- Moderated lost/found and nonfinancial support listings; long identifying numbers
  are rejected in public descriptions.
- Private one-off coordination requests for belongings, skills and support.
  These are visible to the listing owner; unrestricted messaging is not enabled.
- Abuse flags enter a moderator queue; reviewed listings can be withdrawn for review.
- Aggregate CSV export, share links, account activity and account deletion.
- Responsive desktop/mobile interface, keyboard focus, light/dark/large-text modes,
  installable shell cache, upload/body bounds, rate limits and same-origin checks.

The initial public board is intentionally empty. Counts come from actual approved
records, not invented reports, participants or government performance numbers.
Moderation review is not proof of official government responsibility, acceptance,
response or resolution. Public status notes explicitly identify community reporting.

## Quality checks

```sh
npm run typecheck
npm run lint
npm test
npm run build:local
npm run build
```

28 real rule/API tests cover lifecycle, privacy, rounding, permissions, reviewed
organization ownership, volunteer deadlines/registration, private requests,
abuse moderation, secure upload validation, deletion and aggregate/calendar rules.
Python Playwright exercises the actual built UI across desktop and mobile.
See docs/testing.md and actual screenshots under docs/screenshots/.

## Deploy

The independent .openai/hosting.json declares this Site, D1 DB and R2 BUCKET.
Sites provisions resources and applies committed Drizzle schema-only migrations.
Configure trusted ADMIN_USER_IDS or ADMIN_EMAILS in the runtime; ordinary visitors
never become administrators automatically. Hosted authentication is managed by
Sites/ChatGPT. New hosted Sites are private by default.
See docs/deployment.md and docs/security.md.

## Remaining phases

Official institution integrations, verified authority responses, financial
donations/escrow/payments, email providers, sophisticated clustering and paging,
organization/member administration, contact acceptance and reply controls,
priority surveys, project milestone campaigns, server-side photo scanning,
additional languages and national expansion are future phases.
No software license has been selected; OSM and third-party licenses retain their
own terms. There is no emergency response service or direct donation collection.

## Isolated browser verification

Set `APP_STATE_DIR` on the local runner to keep browser fixtures separate from
your saved data. The default remains `.local-state`; existing records are preserved.
For example, use `APP_STATE_DIR=/tmp/community-connect-qa npm run local`,
then run `python3 scripts/e2e.py` in another terminal. Use a fresh directory for
each run. Browser checks include 320px, 390px, 768px and 1440px layouts.
