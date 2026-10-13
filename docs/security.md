# Security and privacy review

Trusted identity is supplied by ChatGPT/Sites dispatch. Ordinary members cannot
change moderator-only issue statuses. Moderators require a runtime allowlist or
database role; public submission does not grant a role. Organization capability
requires ownership of a specifically approved organization record.

Pending content and attachments are private; public record serialization omits
owner IDs. Volunteer interests remain private. Organizers only see registrations
for their own opportunities; moderators can review all. Coordination requests
are private to their submitter and listing owner. Abuse flags are moderator-only.

Coordinates are rounded on the server before database insertion, approximately
one kilometre in the launch region. Descriptions/photos still need human review
to avoid identifying private homes or vulnerable people. Lost/support descriptions
reject long identification/phone number sequences. Do not treat this as a complete
automated personal-data detector.

SQL is parameter-bound. JSON and image bodies are capped while streaming; image
MIME and magic headers must match, and SVG/HTML uploads are rejected. Browser
uploads are re-encoded to remove location metadata. Private images need owner or
moderator access; publicly approved attachment responses use nosniff and a
restrictive image-document CSP. Server-side sanitization/scanning is future work.

Mutations reject cross-origin requests and have database-backed rate limits.
Volunteer actions are idempotent and expired events cannot be joined. Account
deletion removes owned records, photos, notifications and activity, with remaining
audit actor references anonymized. Backups require separate retention controls.

Local preview uses a random HttpOnly SameSite session, a Host allowlist and loopback
bind. It is development-only. There are no donations, payments, unrestricted chat,
official government integrations, public child profiles or email sends.

## Dependency audit — 12 October 2026

Targeted patch updates remove all production dependency findings:
`npm audit --omit=dev` reports 0. The full toolchain audit still reports 19
packages (11 high, 5 moderate, 3 low, including parent propagation), primarily
glob/parser and build/migration utilities. A glob parser has no patched release
available. Build only trusted source and keep development servers on loopback.
A supported toolchain upgrade remains an explicit release task; do not describe
the entire dependency tree as clean. See PRODUCT_PLAN.md for the roadmap.

## Named workspaces and native accounts

Workspace administrators are separate from platform super administrators. Membership is checked on every write. Only the owner or super admin can manage a workspace's admins; a SQLite trigger limits each workspace to 10, including its owner. Native account registration cannot request administrative roles. Unverified native email addresses are excluded from trusted dispatch email-based administrator matching.

Opaque password sessions are hashed before database storage, expire after seven days, and are deleted on logout/account deletion or server-side reprovisioning. Native passwords use a salted PBKDF2-SHA256 derivation; hashes and sessions never appear in API responses. Same-origin authentication writes and bounded payloads are enforced. Deploy over HTTPS, add email verification/recovery and MFA for a broad public launch, and retain the admin-limit trigger when changing the membership schema. No default admin credentials are committed.
