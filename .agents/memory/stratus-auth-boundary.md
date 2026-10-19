---
name: Stratus authentication boundary
description: Why auth redirects and session recovery must respect New API's existing provider contracts.
---

OAuth callback URLs must remain consistent with the backend token exchange and registered provider settings, even when the frontend is previewed under a different path.

**Why:** Adding the frontend preview prefix to an OAuth redirect can disagree with the URI used by the server's token exchange and cause authentication to fail despite a correctly styled callback screen.

**How to apply:** Preserve canonical provider callbacks. Carry only a validated same-origin post-login destination separately; never change provider callback URIs merely because a frontend is mounted under a preview prefix.

Do not assume a session cookie alone is sufficient to recover an unknown signed-in user through the self-account API.

**Why:** New API also requires a matching user-ID header. Polling the self endpoint immediately after provider login without the returned identity cannot establish the account and tempts unsafe ID guessing.

**How to apply:** Use the validated identity returned by the authentication callback, then persist compatible non-secret identity metadata. Keep New API's server-side session and identity checks authoritative.

Authenticator enrollment must never send the TOTP secret to an external QR-code service.

**Why:** Enrollment grants control of the second factor; using a remote QR-image URL would disclose that factor to the image provider and potentially its request logs.

**How to apply:** Keep manual authenticator enrollment available, or generate QR images locally. Keep enrollment secrets and recovery-code responses out of persisted browser state and shared query caches.
