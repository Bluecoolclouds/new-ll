---
name: Gateway capability policy
description: Conservative compatibility decisions for AI Gateway feature-dependent routing.
---

For feature-dependent chat requests, treat a model name or a channel's advertised model list as insufficient proof of support. Unknown combinations should be excluded instead of routed optimistically.

**Why:** An incompatible fallback can silently lose tools, schema constraints, media, reasoning, or streaming semantics after the primary fails. There is no authoritative provider-wide capability catalog for arbitrary custom model aliases.

**How to apply:** When broadening Gateway support, require trustworthy per-model and per-adapter evidence (or explicit administrator configuration), and keep ordinary text-only routing independent of that conservative filter.