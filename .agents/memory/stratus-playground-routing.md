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

The chat should accept photos plus TXT, MD, CSV, JSON, and PDF attachments. Extract document text in the browser; scanned PDFs without selectable text have no OCR fallback. Explicit image-generation prompts route directly to an available image model from the same composer, without a separate classifier request. Keep selected files and conversation history in page memory only.

**Why:** The user asked for automatic image generation inside chat and chose these attachment formats; routing without an extra model call avoids an additional paid request.

**How to apply:** Use `/v1/chat/completions` for text/vision and `/v1/images/generations` or `/v1/images/edits` for image prompts, always with the account's default key. Surface unsupported reference/edit capabilities as server errors instead of silently dropping the photo.

Prefer `gpt-5.5` (then the legacy alias `gpt-5-5`) as the default chat model only when it is returned for the account's key. Build the image picker from that same key-visible `/v1/models` list, using endpoint capabilities from `/v1/models` and `/api/pricing` plus conservative image-family name detection; never invent or expose models the key cannot access.

**Why:** The user asked for GPT-5.5 as the sandbox's base model and all available image models, including GPT Image 2 variants. The project's built-in provider catalog may lag behind custom or newly enabled channel models.

**How to apply:** Keep the preferred default conditional on the live key-visible list. Include GPT Image 2 variants and other image families when present, but only claim they are available after `/v1/models` returns them.
