---
name: Wallet discount is threshold-based
description: How top-up discounts are resolved across the wallet UI; all lookups must use getAmountDiscount, never exact-key
---

# Wallet top-up discount resolution

The discount config (`payment_setting.amount_discount`, surfaced as
`topupInfo.discount`) is a **threshold map**, e.g. `{10: 0.95, 20: 0.9}` meaning
"spend >= 10 → pay 0.95×, spend >= 20 → pay 0.9×". The value is a price
multiplier (< 1 = discount); 1.0 = no discount.

**Rule:** Every place that resolves the discount for an amount MUST use
`getAmountDiscount(amount, discounts)` (highest threshold <= amount), NEVER an
exact-key lookup like `discount[amount]`.

**Why:** Exact-key lookup only matches if the amount equals a configured
threshold. Preset amounts (50/100/200/500) almost never equal the thresholds, so
exact-key lookup silently returns "no discount" while the backend still charges
the discounted price — a confusing mismatch. This bug existed in two places:
the default-preset generator and the dashboard RechargeDialog's discountRate.

**How to apply:**
- `generatePresetAmounts(minAmount, discounts)` and `mergePresetAmounts` both
  attach `preset.discount` via `getAmountDiscount` — pass `topupInfo.discount`.
- Preset cards show a badge only when `preset.discount < 1`.
- The wallet page (`features/wallet/index.tsx`) and the dashboard
  `RechargeDialog` must both compute the active rate with `getAmountDiscount`.
- `PaymentConfirmDialog` consumes `discountRate` from its parent, so the parent
  must supply the threshold-derived rate.
