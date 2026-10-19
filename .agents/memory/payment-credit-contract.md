---
name: Custom payment credit agreement
description: Approved interpretation of pending and future custom-gateway orders; financial scope boundaries.
---

FreeKassa, Heleket, Pally and Platega orders use whole internal USD for stored
amounts and credit `amount × QuotaPerUnit`. This is distinct from wallet tokens.
Apply this interpretation to new and still-pending orders, never retroactively
recalculate successful orders or existing balances.

**Why:** The user explicitly approved the proposed contract with “Да, включая
ожидающие оплаты заказы (рекомендуется)”.

**How to apply:** Preserve each gateway's incoming amount units, existing price
formulas, group multipliers and discount lookup inputs. Reject inputs that
cannot produce exact credits rather than silently truncating them. Changes to
wallet purchase packages or historic balance compensation require separate
agreement; approval of the credit repair is not approval of either.

Legacy Platega pending orders may have a fractional saved quote even though the
old provider request charged integer rubles. Do not treat the saved quote as
proof of the historical external bill.

**Why:** The approved pending-order compatibility must cover actual old invoices,
not only invoices whose saved and transmitted prices happened to match.

**How to apply:** Require authenticated provider confirmation of the old bill;
never extend a legacy rounding allowance to newly created orders.
