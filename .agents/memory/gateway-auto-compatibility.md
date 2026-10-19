---
name: Gateway auto model compatibility
description: Preserve ordinary-token behavior while introducing AI Gateway model selection.
---

Interpret `model: "auto"` as managed model selection only for an AI Gateway key. Ordinary keys must retain normal model routing even when a provider has a real model or alias named `auto`.

**Why:** A global interception of the name would silently break existing clients and aliases. The Gateway mode is opt-in on the key and shares the account balance; it is not a new global model namespace.

**How to apply:** Gate any future automatic-selection or fallback behavior on the key mode, and verify ordinary-key `auto` requests still reach the regular model authorization and channel selection paths.