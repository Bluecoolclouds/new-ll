---
name: Responses stream settlement
description: Billing and client-response semantics when a Responses event stream ends early
---

**Rule:** Once an upstream Responses stream emits events, settle the reported usage or estimate prompt and generated output if terminal usage is missing. Do not return a retryable error or synthesize a successful terminal event for an interrupted stream. An explicit upstream failure without reported usage is not an estimateable success: refund its reservation instead.

**Why:** Returning an error after partial output can trigger another upstream attempt while refunding the first attempt, even though the provider may have already charged for input. Sending a fabricated successful finish misleads clients into treating truncated output as complete.

**How to apply:** Use this distinction consistently in native Responses handling and protocol conversions. Actual upstream usage takes precedence over estimates, including on failed terminal events; empty or explicitly failed attempts without usage must not be charged.