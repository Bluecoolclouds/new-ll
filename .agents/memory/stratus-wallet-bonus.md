---
name: Stratus wallet top-up bonus
description: User-approved RUB bonus curve and amount-entry behavior for Stratus wallet purchases.
---

**Rule:** The bonus grows linearly from 0% at 100 ₽ to 50% at 25,000 ₽. For any amount strictly above 25,000 ₽, it is 70%. The slider stops at 25,000 ₽, but manual entry can exceed the slider; payment-provider and safe-integer constraints still apply.

**Why:** The user specified this pricing behavior for Stratus wallet top-ups.

**How to apply:** Keep quote, checkout, validation, and displayed bonus aligned to the same boundaries. Never clamp manually entered amounts to the slider maximum.
