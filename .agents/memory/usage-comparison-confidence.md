---
name: Usage comparison confidence
description: Why preserved usage history must not imply a trustworthy decrease when collection is disabled.
---

Keep saved usage history viewable when statistics collection is disabled, but do not present its period differences as reliable growth or decline.

**Why:** The API can return valid historical rows without proving that either period was collected completely. The user explicitly requires that missing collection never be presented as a trustworthy decrease. A nonempty response alone is not enough to relax that safeguard.

**How to apply:** Treat disabled collection and failed period loads as unavailable comparisons, not zero activity. A future completeness indicator should rely on recorded collection coverage rather than infer coverage from the existence of usage rows.
