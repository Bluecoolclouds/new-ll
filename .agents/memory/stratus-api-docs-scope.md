---
name: Stratus API documentation scope
description: User-approved scope and accuracy rules for the public Stratus API reference.
---

Stratus API documentation should be available in Russian and English and describe only API routes registered in the current Stratus build. Do not copy a third-party provider's entire catalog as though every method were available. State clearly that usable models, capabilities, and billing depend on enabled models and channels; identify routes that are not implemented.

**Why:** The user chose to document only currently supported Stratus APIs rather than the complete reference provider catalog, to avoid promising functionality that Stratus does not provide.

**How to apply:** When updating the API reference, verify routes against the Go router and distinguish a registered route from a model/channel capability.

For Codex provider setup, `base_url` in `config.toml` is a literal URL; use `env_key` for the API-key environment variable. Never put an actual user's key in shared docs. Do not assume every new account gets a default token: default token generation is opt-in, and generated tokens are unlimited in this build.

**Why:** Official Codex config documents a literal `base_url`, and this project defaults default-token generation off; assuming either environment-variable expansion or universal key issuance would make setup instructions misleading.

**How to apply:** Render the current Stratus domain into copied provider-config examples, keep the API key in a local environment variable, and ask before changing account issuance or unlimited-quota policy.
