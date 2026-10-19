---
name: Stratus playground routing
description: Keep the Stratus playground as one stable page with local Chat and Images modes.
---

The Stratus playground should remain a single page at the existing `/playground` route, with Chat and Images as local modes. Do not add nested mode routes unless the user explicitly asks for them.

**Why:** The user asked for a simple sandbox page inside Stratus; nested `/playground/chat` and `/playground/images` paths led to a reported 404.

**How to apply:** Keep the account header pointed at `/playground`, switch modes within that page, and redirect any legacy nested links to the base playground route.
