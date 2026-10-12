# CommunityConnect product plan

## Purpose and users
Help Otukpo/Benue residents report concerns, coordinate volunteer work and discover
community opportunities. Community review never implies official government
acceptance, responsibility or action. Public boards start empty rather than
inventing reports, opportunities or participation counts.

## Working MVP and architecture
Independent React/TypeScript app, Worker REST API, relational D1/SQLite store and
R2 photos. ChatGPT identity is checked on the server. The loopback runner uses a
clearly identified development moderator and must not be publicly exposed.
See README.md, db/schema.ts, docs/api.md and docs/security.md.

Implemented: private pending reports, reviewed lifecycle histories, follow/notify,
aggregate dashboards, coarse map locations, reviewed organizations, owner-scoped
opportunities/volunteer registration, skills, events/calendar export, moderated
lost/found and nonfinancial assistance, private one-off coordination, abuse flags
and account deletion. No transactions, unrestricted chat or invented officials.

## Improvements in this delivery
- Filter privacy, ownership and listing type in SQL before the listing cap. A
  backlog of pending submissions must not hide public issues or private records.
- Validate dates by a UTC round trip; parsing alone normalizes impossible dates.
- Close participation after the event day even when no deadline was supplied.
  Eligibility uses Africa/Lagos dates, appropriate to the communities served.
- Validate public HTTPS URLs structurally and reject embedded credentials.
- Apply the tested dependency patches from MindGrow, with independent lockfiles.

## Security and low-cost decisions
Explicit moderator allowlists, parameterized queries, same-origin writes, per-user
rate limits and upload ownership/size/type checks protect the API. Coordinates
are rounded to 0.01 degrees. Residents should avoid public personal details.
Organization review is a platform review, not legal verification or endorsement.
Use OSM attribution and ordinary interactive tiles, never bulk offline downloads:
https://operations.osmfoundation.org/policies/tiles/.
The existing SQLite-compatible schema avoids a paid database server. Schema
migrations, /api/health and error monitoring support operation; establish backups,
retention and restore drills before a wider public release.

## Next phases
1. Evidence standards, formal moderation operations and resolution evidence review.
2. Duplicate suggestions, pagination and larger-directory aggregation.
3. Organization membership controls and accepted coordination/reply workflows.
4. More local language content, surveys and community project milestones.
5. Supported build-toolchain migration and server-side photo scanning.
Financial payments, authority integrations and emergency dispatch need separate
requirements and safeguards and are not implied by this MVP.

## Acceptance
Real SQLite API tests for privacy, transitions, organization ownership, participation,
large pending backlogs and dates; strict types/lint, both builds and browser
report-to-resolution/volunteer/community-board journeys at desktop/mobile sizes.
Push the independent project before adding its screenshot-backed portfolio card.
Status: working MVP, continuing development; the advanced brief is not complete.
