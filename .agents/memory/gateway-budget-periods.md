---
name: Gateway budget periods
description: Boundary and currency decisions for per-key Gateway budgets
---

**Rule:** Daily and monthly Gateway limits in Stratus are entered and displayed in wallet tokens. Convert them to the application's configured quota units for backend accounting. Limits reset at UTC midnight and the first of the UTC month.

**Why:** The user wants Stratus wallet limits in tokens, consistent with the wallet's unit; the backend still accounts in quota units. A single timezone keeps each limit consistent across replicas and user locations.

**How to apply:** Use the existing wallet-token ↔ quota conversion in Stratus; do not convert through USD or a display-currency preference. Preserve the backend's quota accounting and UTC period boundaries.