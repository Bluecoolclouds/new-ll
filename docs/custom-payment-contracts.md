# FreeKassa, Heleket, Pally and Platega

## Approved credit contract

These four gateways store `TopUp.Amount` as **whole internal USD**.
Settlement credits `Amount × common.QuotaPerUnit`, not `Amount` raw quota.
At the default quota unit of 500,000, a 10-internal-USD order credits
5,000,000 quota units. These are not wallet-token quantities.

The user approved applying this interpretation to both new and still-pending
orders. Completed orders and existing balances are not recalculated or repaired
retroactively. The exact wallet-token package purchase rate is separate work.

Creation input remains compatible with the existing wallets:

| Gateway | `amount` input | Pay endpoint |
| --- | --- | --- |
| FreeKassa | Internal USD in currency mode; exact whole-USD quota multiples in TOKENS mode | `/api/user/freekassa/pay` |
| Heleket | Whole internal USD | `/api/user/heleket/pay` |
| Pally | Whole internal USD | `/api/user/pally/pay` |
| Platega | Whole internal USD, with optional `sub_method` | `/api/user/plategal/pay` |

The matching `/amount` endpoints and all `/pay` endpoints require the existing
user session. Pay endpoints retain critical-request rate limiting. Invalid,
negative, fractional or unsafe amounts fail before an external order is created.
FreeKassa no longer silently truncates fractional internal USD in TOKENS mode.

## Prices

Existing unit prices, group multipliers and discount lookup inputs are unchanged.
In particular, FreeKassa's TOKENS discount lookup still uses the incoming quota
amount; Heleket, Pally and Platega use the incoming internal USD amount.
Pally and Platega retain their existing 500,000 pricing basis. No administrator
settings are rewritten. Quote totals and provider totals use the existing
gateway rounding rules. Platega amounts retain kopecks rather than being
silently cast to integer rubles.

## Notifications

Configure the following paths on the existing public server address in the
corresponding merchant dashboards (this change does not publish the server or
change merchant settings):

| Gateway | Public callback | Authentication |
| --- | --- | --- |
| FreeKassa | `GET` or `POST /api/freekassa/notify` | Merchant ID and Secret Word 2 MD5 signature |
| Heleket | `POST /api/heleket/webhook` | MD5 of Base64 of the ordered JSON without `sign`, plus API key |
| Pally | `POST /api/pally/webhook` | `SignatureValue` over `OutSum:InvId:API token` |
| Platega | `POST /api/plategal/webhook` | Exact `X-MerchantId` and `X-Secret` headers |

Heleket sends its callback address during invoice creation. FreeKassa, Pally
and Platega need the notification URL configured in their merchant dashboards.
Browser redirects are navigation only and never establish payment.

Only final paid statuses are settled (`paid` / `paid_over`, `SUCCESS`,
`CONFIRMED`, respectively). All settlements verify gateway ownership and amount;
Heleket and Platega also verify currency. Currency is snapshotted for new orders.
Older pending orders without a snapshot use the existing configured currency.
FreeKassa's notification protocol does not supply a currency field.

Platega creation uses `/transaction/process`, numeric `paymentMethod` IDs
2/11/12 and the returned `redirect`. Its transaction ID is stored with the order.
Official callbacks need not include a merchant payload. When a legacy pending
order lacks a transaction binding, the handler retrieves the transaction via
authenticated `GET /transaction/{id}` and checks its status, amount, currency and
merchant payload before locating and settling the order.
For pre-snapshot legacy Platega orders only, the stored fractional quote is
compared using its historically transmitted integer-ruble amount. This exception
requires authenticated transaction recovery and never applies to new snapshotted
orders, which must pay the exact kopeck amount. Historical quotes are not rewritten.

Status, completion time, user credit and the existing FreeKassa referral reward
are committed in one database transaction. A database failure leaves the order
pending for retry. Successful duplicates do not credit or reward twice.
New optional order metadata is added through the existing TopUp migration;
there is no historical balance migration.

## Isolated verification

No real gateway payments or production database access are needed:

```sh
go test ./controller ./router -run 'TestCustomPayment|TestLegacyPlatega|TestHeleketSignature|TestStratusWallet' -count=1
cd web/stratus && bun run typecheck && bun test tests
```

Tests replace the HTTP transport and use disposable SQLite databases. They cover
both display modes, actual order handlers, outbound authentication, notification
signatures, invalid input and amounts, wrong gateway/currency, non-paid and
expired orders, repeat/concurrent delivery, injected database failure and retry,
legacy Platega recovery, exact user credit and FreeKassa's existing referral
reward. Live merchant configuration still needs to match the callback paths.

Provider contract references:
- https://doc.heleket.com/en/methods/payments/webhook
- https://docs.platega.io/createtransactionrequest-13226217d0
- https://docs.platega.io/createtransactionresponse-13226218d0
- https://docs.platega.io/callbackpayload-13226220d0
