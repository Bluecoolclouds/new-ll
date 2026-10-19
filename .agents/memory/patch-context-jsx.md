---
name: Safer patching for large JSX
description: Reliable edit strategy for long UI modules with exact source context.
---

For large JSX components, apply small, independent patches and avoid copying context from truncated output.

**Why:** A stale context segment rejected a component update while edits to other files in the same patch had already applied.

**How to apply:** Search for the exact lines around each change, patch one logical hunk at a time, then inspect the diff before continuing.
