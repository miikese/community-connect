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

## Languages

Use the language menu for Hausa/Igbo navigation and open **Translator** for text translation across 22 languages. Supported pairs use the free MyMemory service. Idoma and Tiv use approved contributions from fluent community members; missing translations invite a contribution. Public listing details also offer translation. See [translation behavior, privacy and checks](docs/translation.md).

## Schools, streets and community workspaces

Create a personal account through **Sign in → Create account**, then use **Schools & communities → Register a workspace**. Register a school, street or community under its own name, LGA, public area and description. The creator is its owner and first posting admin; registration stays private until the platform super admin approves it.

Owners can assign up to **10 admins including themselves**, using the person's already registered account email. Delegated admins publish/edit/remove notices, events, opportunities and updates in their own workspaces. They cannot approve platform registrations or add admins elsewhere. Owners can remove admins, transfer ownership to an existing admin, or delete a workspace. The database enforces the 10-admin cap even for concurrent requests.

Approved workspace updates appear in their local feed, the **Schools & communities** shared feed, and a preview on the general **Action board**. Suspended workspaces disappear from public feeds and cannot publish. Public feeds omit account emails and credentials; this is a public notice system, not a private student records portal.

### Super-admin login

Build locally, then provision an administrator on the server:

```sh
npm run build:local
node scripts/create-super-admin.mjs --email owner@example.com --name "Platform owner"
```

Enter the password at the hidden prompt. The command writes a salted password hash to the ignored local database, grants the super-admin role and revokes existing password sessions. Accounts and passwords are never seeded in Git. Use the normal email/password login form, then open **Platform admin** to approve, reject or suspend workspace registrations.

Native accounts use PBKDF2-SHA256 with a random salt and 100,000 iterations, plus opaque, hashed, seven-day session records and HttpOnly/SameSite=Lax cookies (`Secure` on HTTPS). Authentication checks same-origin requests and enforces per-email and shared app limits. Email ownership verification, password recovery and multi-factor authentication are further deployment work; unverified account emails never grant platform-admin access. ChatGPT dispatch identities remain an optional trusted sign-in path. On hosted deployments, configure verified platform admin identities or provision roles through the secured database administration workflow; the local provisioning command targets the local SQLite database.

The new schema is in migrations 0001 and 0002; apply both when deploying existing D1 instances. Local startup applies them automatically. Existing records and translation features remain available.

Checks: 43 unit/API tests, type checking, lint, both builds, the original reporting and translation browser journeys, and `scripts/workspaces-check.py` (native signup, super-admin login, school registration/review, delegated posting, public feed and mobile layouts). The CLI and actual password hashes stay server-side.

## Messenger, usernames and groups

Open `/messages` (or **Friends & chat**) for the dedicated messenger workspace.
Every account receives a unique username. New members choose one at signup;
existing members keep their profile username or receive a private default on
next sign-in, which they can change under **My profile**. Discovery is opt-in.

- Direct conversations require an accepted friendship. Create named private
  groups with 1–5 accepted friends; each group supports up to six people.
- Filter the inbox by All, Unread, Read, or Groups; pin conversations and mark
  them read or unread. An unread reminder never withdraws an existing receipt.
  Group receipts count the current members who have read a message.
- Record and review voice notes (up to two minutes) or video notes (up to one
  minute) before sending. Recordings are bounded to 12 MB and stored privately
  in R2. Only authorized conversation participants can stream them, including
  byte-range playback. Removing a friendship, blocking, or leaving a group
  removes the corresponding access. Unsent uploaded drafts can be discarded.
- Direct and group voice/video calls use real browser WebRTC media. Group calls
  support up to six members, participant-level mute/camera controls, leaving,
  host ending, session expiry, and authenticated participant-only signaling.
  Calls acquire devices after an explicit action and stop tracks when leaving.

Apply all pending migrations (the messenger adds 0004 and 0005). Local startup
and Sites publication handle migrations; existing accounts and messages remain.
The local upload runner supports the same private range requests as hosted R2.

Public STUN is available by default. For reliable connections across restrictive
networks, configure `RTC_TURN_URLS` and a coturn-compatible `RTC_TURN_SECRET` as
private runtime variables. The server issues short-lived credentials; the shared
secret is never sent to browsers. Calls are not recorded. Message notes are
stored for their conversation and are not end-to-end encrypted.

Verification:

```sh
npm run typecheck
npm test
npm run build:local
APP_URL=http://127.0.0.1:3110 /path/to/playwright-python scripts/e2e-messenger.py
APP_URL=http://127.0.0.1:3110 /path/to/playwright-python scripts/e2e-social.py
```

The messenger browser test uses three separate accounts and synthetic camera/
microphone devices to verify group creation, read/unread state, actual recording
playback, three-way video frames, voice calls, controls and resource cleanup.

### Device sharing, memes and Status

Chats and private groups now accept photos, MP4/WebM videos, PDFs, text/CSV, ZIP and Office documents from the device (up to 25 MB per upload). Documents download as attachments; unsupported active-content formats are rejected. A canvas meme editor accepts your own image or a colored background, with editable captions, preview and PNG download. Images and memes can be sent in chat or posted to Status.

Friends & chat → Status supports text, photos, video and memes, visible only to current accepted friends for 24 hours. Blocking/removing a friend revokes access. View counts are visible only to the owner, with one count per viewer. Owners can delete active updates and their files. Expiry is enforced for both posts and media on the server; the uploader's next status publication also removes up to 50 expired updates and their files. Other expired storage can remain until that cleanup or account deletion; it is not publicly accessible. Initial limits are 20 posts/day and 150 MB of uploaded media/day per account. No external meme API is required.

Validation: `npm test`, `npm run typecheck`, `npm run build:local`; browser checks in `scripts/e2e-uploads-status.py` use synthetic accounts and an isolated local server, alongside the existing messenger/call regression suite. Never run synthetic signups or test calls against production.
