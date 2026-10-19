---
name: Image billing integrity
description: Conservative handling of successful image responses without billable image payloads.
---

Treat a nominally successful image response with no image payload as a failed request, not as proof that the requested number of images was generated.

**Why:** Using the requested quantity as a fallback for an empty successful response can settle a reservation for images the customer never received. Erroring before settlement lets the billing session refund its reservation. On interrupted streams, however, do not reduce the requested charge solely from a partial event count: the upstream might still have generated more images.

**How to apply:** When changing image adaptors or stream accounting, distinguish complete empty responses from incomplete streams; count only image-bearing payloads, and retain conservative interrupted-stream charging unless there is an explicit upstream failure.