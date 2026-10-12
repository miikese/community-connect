# Independent deployment

Requires Node 22.13+ and npm. Install with npm ci, run typecheck/lint/tests,
build the local companion and the hosted Worker with the npm scripts.

.openai/hosting.json declares independent Site identity, D1 DB and R2 BUCKET.
Keep the maintained Sites/Vinext Worker integration. The host provisions bindings
and applies generated Drizzle SQL migrations before publication.
Configure ADMIN_USER_IDS (Site-specific stable user IDs) or ADMIN_EMAILS (verified
platform email allowlist) using host runtime secrets. Never promote the first
visitor automatically. ChatGPT/Sites owns hosted authentication.

Use the source helper to push the exact tested source and package its Worker
artifact; publish that commit/archive. Check /api/health and native deployment
status. New Sites are private unless the owner explicitly changes the audience.

For framework preview, build and apply each unapplied SQL migration:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_normal_ben_urich.sql
```

The lightweight local companion automatically applies migrations to its own
separate SQLite database. Local static/API output lives in .local-build, so a
hosted Worker build never removes the preview. Runtime data stays ignored.
The local companion's mock sign-in must not be deployed as public authentication.

Before broad public use: establish moderators, trusted organization review,
backup/restore, retention, photo sanitization/scanning, data export and abuse policy.
There are no paid services, external email sends or financial transactions.
