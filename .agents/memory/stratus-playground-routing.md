---
name: Stratus playground routing
description: Keep the Stratus playground as one stable page with local Chat and Images modes.
---

The Stratus playground should remain a single page at the existing `/playground` route, with Chat and Images as local modes. Stratus mounted at the site root uses an explicit frontend-route allowlist; every new root-level Stratus route must be added there too.

**Why:** The user asked for a simple sandbox page inside Stratus. If `/playground` is missing from the root-route allowlist, the server serves the default New API frontend there, even while `/dashboard` serves Stratus.

**How to apply:** Keep the account header pointed at `/playground`, switch modes within that page, and update `useStratusFrontend` plus its tests for any new root-level Stratus route. Keep `/stratus/...` preview routes separate.

The sandbox's model list, chat, and image generation must use the user's active default unlimited API token through `/v1`. Session-authenticated routes may bootstrap or reveal only that user's key; keep the key in page memory, never persistent browser storage. An unlimited key quota does not bypass wallet billing.

**Why:** The user explicitly requires the sandbox to behave like their API-key client. Session-only playground relays bypass token identity and key-specific limits.

**How to apply:** Send actual model and generation requests with the bearer key to `/v1`; use session auth only to ensure/retrieve the account-owned default key, while preserving standard wallet settlement.
