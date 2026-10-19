---
name: Gateway channel health scope
description: Why adaptive Gateway channel health is local to each server process and when to revisit it.
---

Gateway channel health and recovery probe leases are process-local, bounded observations. Do not assume a cooldown on one replica applies to another. Aggregate model performance history can inform ordering but is not a substitute for channel-specific failures.

**Why:** The initial implementation avoids adding a distributed coordination dependency to latency-sensitive relay requests. With multiple replicas, each learns independently and may briefly try a failing channel before its own cooldown activates.

**How to apply:** If routing must be consistent across horizontally scaled instances, add a shared short-lived health store and atomic probe lease while preserving the bounded window, minimum observations, and fail-open behavior if the store is unavailable.