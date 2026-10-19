---
name: Gateway lease recovery
description: Concurrency rule for recovering abandoned Gateway parallel-request reservations
---

**Rule:** Serialize expired-reservation cleanup, live lease renewal, new acquisitions, and settlement against the same key. Stop renewing when a request ends even if settlement fails; reconcile the displayed active count from live persisted reservations rather than trusting an old process's counter.

**Why:** A process crash leaves no cleanup callback; a late completion or concurrent restart must not decrement a new request's slot. Renewal and expiry cleanup without the same lock could race and reclaim a still-running request. A settlement error after the request has ended must not keep renewing an abandoned slot indefinitely.

**How to apply:** Any new Gateway admission or lease-maintenance path must participate in the per-key serialization boundary. Keep monetary refunds tied to the reservation's original UTC accounting periods.