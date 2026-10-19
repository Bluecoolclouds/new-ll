# Stratus wallet boundary

Stratus displays New API quota as wallet tokens using the shared conversion:
`quota / quota_per_unit * 100 / 13 * 1,000,000`. The approved base is now
**11.57 RUB per million**, not the former 11 RUB: `11.57 / 89 = 0.13 USD`.
This does not change a stored
balance, a tariff, or the number of provider usage tokens.

## Exact pack contract

The user approved 11.57 RUB rather than a fractional-quota remainder. At the
supported 500000 quota/USD conversion, one million wallet tokens credits
**65000 integer quota**, exactly. No rounding or fractional-USD storage is used
for credits, and no existing balance, pending legacy order, or model tariff is
recalculated. Displayed balances and tariff multipliers use the new conversion;
the previously approved Luna tariff is deliberately not reset to force ×1.

`GET /api/user/topup/stratus/info` puts exact pack methods before legacy methods.
They use `quantity_kind: "packs"`; their `min_usd`/`max_usd` fields are quantity
bounds for compatibility with the adapter's existing method envelope, not USD.
`POST /api/user/topup/stratus/quote` takes `{method: "packs:<id>", packs: N}`.
Do not send `usd` for these methods.

`POST /api/user/topup/stratus/pay` is authenticated and rate limited. It accepts
only the selected method, integer pack count, and the quoted expected cash,
currency and quota. It reloads the user's group and current payment eligibility,
recalculates everything server-side, and rejects changed quotes before inserting
an order or calling a provider. The checkout never credits the balance.

Exact packs support configured FreeKassa variants, Heleket, Pally and Platega.
Their **new pack contract** uses 11.57 RUB or 0.13 USD per pack, rather than
overwriting any legacy gateway unit-price setting. Currencies other than RUB
and USD are explicitly unavailable for packs. Existing provider minimums remain
in force; a provider minimum may prevent buying only one pack. Heleket retains
its minimum in USD. The group multiplier applies to cash, not credited tokens.
An existing USD amount discount applies only if the selected packs represent
that *exact integer USD key* (for example, 100 packs = 13 USD); fractional USD
never matches a truncated key. No new discount tiers are created or removed.
Cash is calculated with decimal arithmetic and rounded half-up to two decimals
once at the end. Credit is always `N × 65000`, with safe-integer quantity bounds.

New orders persist `wallet_packs`, `wallet_quota`, the final `money`, currency,
provider, and legacy `amount = 0`. Both wallet fields default to zero in migrated
old orders. A pack snapshot must match its pack count and an eligible provider.
Authenticated existing notifications validate the saved price/currency and
credit the snapshot transactionally exactly once, even if configuration changes
after checkout. Administrative completion understands the same snapshot.
Provider-reference validation and FreeKassa referral behavior remain in place.
An invoice-creation timeout leaves a pending order: it might have created a
real invoice upstream, so a later valid notification must still be accepted.

Stripe PriceIds and Creem products remain external configured products, not
silently repriced pack products. Epay/Waffo retain their legacy purchase APIs.
These methods remain available under the explicitly labelled **legacy tariff**;
they do not advertise an exact million-token package at 11.57 RUB. Supporting
packs through their different checkout contracts needs a separate integration,
not sending 0.13 to an integer-quantity API or changing an external PriceId.

## Legacy read-only adapter

Authenticated `GET /api/user/topup/stratus/info` lists configured methods,
representable whole-USD purchase quantities, existing amount options, redemption
availability, and any reason a configured method cannot be used.

Authenticated `POST /api/user/topup/stratus/quote` accepts `{method, usd}`.
`usd` must be a whole internal purchase unit; Creem instead selects one configured
product. It returns the price/currency, exact credited quota, existing payment
endpoint and its payload. It does not call a provider, create an order, or credit
an account. The UI compares a fresh quote before submitting the existing payment
request. Changes to payment contracts require separate approval.

## Existing contracts checked

| Provider | Existing `amount` | Price | Actual credit |
| --- | --- | --- | --- |
| Epay | integer USD; integer internal quota in TOKENS display | existing Price × group × exact amount discount, two decimals, ≥0.01 CNY | stored whole USD × quota_per_unit |
| Waffo | integer USD; integer internal quota in TOKENS display | unit price × group × exact amount discount; gateway currency precision | stored whole USD × quota_per_unit |
| Waffo Pancake | integer USD; integer internal quota in TOKENS display | unit price × group × exact amount discount, two decimals, >0.01 USD | stored whole USD × quota_per_unit |
| Stripe | integer quantity passed unchanged to configured external PriceId | local estimate only; actual currency, price and promotions belong to checkout | request amount × topup group ratio × quota_per_unit, independent of local price estimate |
| Creem | configured product_id, no amount | configured product price; external checkout remains authoritative | product.quota directly, NOT USD × quota_per_unit |
| FreeKassa | integer USD; internal quota in TOKENS display | configured price × group × exact amount discount, two decimals; existing minimum checks | stored whole USD × quota_per_unit |
| Heleket | integer USD | existing unit price × group × discount | stored whole USD × quota_per_unit |
| Pally / Platega | integer USD | existing 500000-credit price × group × discount, RUB minimum | stored whole USD × quota_per_unit |

The adapter converts whole internal USD into the legacy TOKENS request only for
handlers which divide by quota_per_unit. It never sends wallet-token counts to
these endpoints. Whole USD avoids their truncation of fractional USD.
Configured discounts remain exact-key discounts; no new tiers are created.

Stripe TOKENS minimum can exceed its hard maximum of 10000 raw units. In that
configuration the method is unavailable, not silently normalized. Its local
price estimate is never labelled the exact payable total.

Creem products require both checkout configuration and an operational webhook.
Products remain visible but unavailable when the webhook secret is absent;
checkout credentials alone must not permit a purchase that cannot be credited.

FreeKassa, Heleket, Pally and Platega payment/webhook handlers are registered.
Their separately approved credit repair interprets both new and still-pending
legacy orders as whole internal USD; completed historical balances are unchanged.

The 11.57 RUB/million and 89 RUB/USD business conversion does not override
legacy gateway prices, external PriceIds, group settings or discounts. Exact
small packages use only the separate contract above.

## Confirmation and return

Hosted checkout uses same-tab navigation; Epay uses the returned top-level form
action and fields. Only HTTP(S) URLs are accepted. A session marker aids return
navigation but is never treated as confirmation. `/wallet` and legacy return
aliases select Stratus only when Stratus is active. `/stratus/wallet` always
supports preview. Server order history is the authority for success, expiry and
pending status, with background polling and explicit refresh. Historical
`TopUp.money` and `TopUp.amount` have provider-dependent units, so the UI does
not fabricate a currency or a token credit for old orders.

The actual theme-aware Epay/Stripe return is `/usage-logs`, not `/console/log`.
Both routes select the Stratus return handler when Stratus is active. A validated
wallet marker returns the user to the originating wallet with `payment=return`;
the wallet consumes the marker without interpreting it as a successful payment.
Without a marker, the route remains an account usage view.
