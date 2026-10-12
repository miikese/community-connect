# Executed validation

23 Vitest rule/API tests use a real in-memory SQLite database and the committed
migration. They cover authentication/origin rules, pending-content privacy,
server-side coordinate rounding, member/moderator permissions, the full seven-stage
issue lifecycle, audit history, follower notifications, organization ownership,
activity joining/deadlines, participant access, private coordination requests,
abuse flags, upload validation, data deletion, aggregate counts and calendar escaping.

Browser journeys run against the actual built React application. They submit a
report, confirm private/coarse storage, advance every lifecycle stage with UI
moderation, follow the report, approve an organization, publish and join an activity,
submit skills/notices/belongings/support, remove test data, and check desktop/mobile
navigation and horizontal overflow. No real community content is fabricated.

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
# In another terminal: PORT=3103 npm run local
python3 scripts/e2e.py
```

PLAYWRIGHT_CHROMIUM_EXECUTABLE can select a system Chrome.
Actual screenshots live in screenshots/. Hosted ChatGPT sign-in is separate from
local development identity; public map tiles are best-effort and attributed.
TypeScript, lint, both production builds and browser checks run in GitHub Actions.
