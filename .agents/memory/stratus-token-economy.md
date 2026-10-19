---
name: Stratus token economy
description: User's business requirements for token-denominated wallet and model price multipliers.
---

The Stratus wallet must show the balance in tokens rather than dollars. Model spending/pricing must be presented as multipliers such as ×6 and ×0.9 instead of the usual separate input/output prices.

**Why:** The user specified: “кошелек теперь считаем не долларами а токенами” and “траты на разные модели типа х6 х0.9 ... а не привычные аутпут инпут”.

**How to apply:** Carry this requirement into the wallet migration and model-price UI. Do not invent an exchange rate or silently equate wallet tokens, provider usage tokens and internal quota units. Any billing-formula change needs an explicit business rule, not merely a currency-label replacement.

The base purchase rate is **1 million wallet tokens for 11.57 RUB**, at the fixed **89 RUB/USD** conversion, without a fractional-quota remainder. This supersedes the original 11 RUB base. Text-model spending is **(input tokens + output tokens) × the model coefficient**.

**Why:** After asking whether a nearby price could avoid fractional accounting, the user chose “11,57 ₽ — без дробного остатка”. The original spending formula was “Входные + выходные токены, умноженные на коэффициент”.

**How to apply:** Use the approved purchase base, but do not retune model spending tariffs to keep an old displayed multiplier after this wallet conversion changes. Do not invent discount thresholds or percentages. Server-side calculation and payment validation remain authoritative.

The agreed conversion rate for internal New API USD tariffs is **1 USD = 89 RUB**.

**Why:** The user explicitly supplied 89 when asked for the USD → RUB rate used to derive model multipliers.

**How to apply:** Use this fixed business rate together with the 11.57 RUB per million wallet tokens base. Do not substitute the legacy USD/CNY rate or a live market exchange rate without approval.

Stratus token top-ups earn a progressive token bonus: 0% at 100 RUB, increasing linearly to 50% at 2,000 RUB, and capped at 50% above that. Keep the approved base rate at 11.57 RUB per 1M tokens.

**Why:** The user set the 100–2,000 RUB bonus curve and chose to keep the current 11.57 RUB base rate after reviewing the 420M example mismatch.

**How to apply:** Calculate the bonus in the server quote and snapshot the final quota in the pending order; credit it only after verified provider confirmation. For token-package purchases, use this bonus instead of stacking the legacy exact-USD discount. Keep legacy discount settings and unrelated payment routes intact.

Coefficients are individual to each model, not one global coefficient. The user explicitly approved **GPT-5.6 Luna ×1** for ordinary input and output text at group ratio 1; no other new model coefficients were approved.

**Why:** The user stated “у каждой модлели свой коэф” and confirmed “Да, установить Luna ×1” after seeing the USD conversion and rounding impact.

**How to apply:** Keep that business approval distinct from illustrative coefficients. Do not infer rates for other models or reset later administrator changes on restart. Additional model rates need agreement before changing monetary settings.

Model multipliers must be derived automatically from the site's effective billing tariffs, including newly added models, rather than maintained manually in Stratus.

**Why:** The user requested “чтобы потом удобно было добавлять модели и они сами определяли иксы от нашего тарифа по списанию”.

**How to apply:** Use published effective model and group prices as the source of truth. Convert them through an explicitly agreed wallet exchange rate. Do not invent a USD/RUB rate or present different input/output, dynamic, or media prices as one exact coefficient without first making the server tariff match that claim.

The public Stratus catalog may show a client-facing “from” price derived from the lowest enabled wallet-token multiplier, with a 50% display discount. This is presentation only; it must not change server billing, wallet coefficients, checkout, or purchase-volume discounts. Keep fixed-request prices per request, and never evaluate raw dynamic billing expressions in the browser.

**Why:** The user explicitly requested a 50% Stratus discount in the public price list, calculated from the cabinet's tariff logic, while asking for dynamic image tariffs to be displayed without exposing their raw expressions.

**How to apply:** Use “from” for the minimum applicable model/group/token rate, apply the 50% discount only to the displayed USD estimate, and label request-based prices separately. Leave actual charges to the server; if a dynamic expression cannot be safely interpreted, show no calculated price instead of guessing.

Frontend wallet migration must preserve existing payment input units, prices,
discount settings and actual credit behavior. Changes needed for exact small
token packages or for repairing a payment contract require separate agreement.

**Why:** The wallet assignment explicitly required checking server contracts
first, not sending wallet-token counts to USD APIs, and agreeing necessary
contract changes separately. The fixed wallet conversion is not permission to
override other tariffs or enable unsafe payment routes.

**How to apply:** Show only purchases the current server can fulfill accurately,
distinguish reference conversion from actual gateway prices, and make unavailable
or inconsistent payment paths explicit rather than presenting them as working.

The Stratus model-pricing panel should show one compact “Кэш-вход: 40%” footer.
Do not show the longer cache explanation, pricing-formula disclaimer, or
RUB/USD conversion disclaimer in that panel.

**Why:** The user asked to remove those paragraphs and requested the screenshot's
bottom treatment without its Priority item.

**How to apply:** Render one cache footer below the model list, without Priority.
This is display-only and does not change server cache ratios or billing.
