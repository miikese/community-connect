# Community languages

The Translator supports 22 selectable languages, including Hausa, Igbo, Yoruba, French and Arabic. It uses the free MyMemory service where the provider supports the chosen pair. Approved community translations are used first. Hausa and Igbo have curated navigation labels; the rest of the interface currently retains English text.

Idoma (`idu`) and Tiv use community translations only. A fluent member signs in, enters an original text and translation, and submits them privately. An authorized moderator checks the source, target and wording with a fluent language reviewer before approving. The exact approved original/source/target combination then works in the Translator. Pending translations never serve as translations. A missing translation shows a contribution prompt, not fabricated text.

Automatic outputs are labelled and the original listing remains visible. The Translator requires consent before sending text to MyMemory. Listing translation is offered only for public content; private profiles and unapproved submissions are excluded. Remove personal information from free text before translating. Approved translations become public records, so contributions must also be suitable for publication.

`POST /api/translate` takes `{text, source, target}`. It bounds input to 2,500 UTF-8 bytes, splits provider requests under 450 bytes, validates language codes, handles quotas/timeouts, blocks cross-origin requests, and applies a shared 12-request-per-minute app limit. The provider can still reject unsupported language pairs or exhaust its free daily quota. Do not treat automated translations as fluent-speaker approval.

No key is needed for the default free tier. An optional `MYMEMORY_API_KEY` must be configured server-side, never in browser code. An API key does not establish Idoma support. Provider documentation: https://mymemory.translated.net/doc/spec.php and https://mymemory.translated.net/doc/usagelimits.php. The service sends text to an external provider; it is not an offline translator.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, both builds, the existing `scripts/e2e.py`, and `scripts/translation-check.py` using Python Playwright. Live Hausa and Igbo requests were also checked. Workflow fixtures are explicitly test text, not actual Idoma-language evidence. Language labels should receive native-speaker review before a broad public rollout.
