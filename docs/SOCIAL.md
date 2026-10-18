# Friends, chat and calls

Signed-in members create a separate social profile. Discovery is opt-in and never exposes account email. A request must be accepted by its recipient before messaging or calls are available. Blocks end calls and remove the friendship. Unblocking requires a new request. Messages are plain text, stored in D1 for their two participants, with idempotent send requests, pagination and read receipts. They are encrypted in transit, not end-to-end encrypted.

Voice and video calls use the browser's WebRTC API. Only calling or accepting asks for microphone/camera access. Media is not stored. Signaling is participant-only; descriptions are cleared when a call ends or expires. A user can have one active call at a time. Refreshing ends the local call and releases device tracks. The other participant sees it end. Polling keeps incoming calls available while a signed-in page is open; there are no background push notifications.

## Call relays

The default configuration uses the Google public STUN endpoint documented by WebRTC. Direct connections work on compatible networks. For restrictive NATs or firewalls, configure a coturn-compatible TURN server with `use-auth-secret` and set these private runtime variables on the Site:

- `RTC_TURN_URLS`: comma-separated `turn:` / `turns:` URLs.
- `RTC_TURN_SECRET`: the TURN server's private shared secret.

The backend generates one-hour HMAC-SHA1 credentials. The shared secret stays on the server. The UI reports when no relay is configured. Do not claim calls work across every network until a relay is configured and tested between different networks. HTTPS is required except on localhost.

Sources: https://webrtc.org/getting-started/peer-connections and https://github.com/coturn/coturn/blob/master/README.turnserver .

## Verification

`npm run typecheck` and `npm test` cover participant authorization, consent, blocking, idempotent messages, paging, call ownership/busy/expiry, account deletion, and TURN credential redaction. Run the social browser journey against isolated local state only. Test calls with two independently signed-in browsers and fake media; confirm decoded remote frames before considering video verified.
