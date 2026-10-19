---
name: Stratus playground routing
description: Keep the Stratus playground as one stable page with local Chat and Images modes.
---

The Stratus playground should remain a single page at the existing `/playground` route, with Chat and Images as local modes. Stratus mounted at the site root uses an explicit frontend-route allowlist; every new root-level Stratus route must be added there too.

**Why:** The user asked for a simple sandbox page inside Stratus. If `/playground` is missing from the root-route allowlist, the server serves the default New API frontend there, even while `/dashboard` serves Stratus.

**How to apply:** Keep the account header pointed at `/playground`, switch modes within that page, and update `useStratusFrontend` plus its tests for any new root-level Stratus route. Keep `/stratus/...` preview routes separate.
