---
name: Heleket API sign formula
description: Correct signature formula for Heleket (Cryptomus-based) payment API and amount unit conventions
---

## Sign formula

```go
func heleketSign(jsonBody []byte, apiKey string) string {
    encoded := base64.StdEncoding.EncodeToString(jsonBody)
    raw := encoded + apiKey   // NO colon between base64 and apiKey
    return fmt.Sprintf("%x", md5.Sum([]byte(raw)))
}
```

**Why:** Heleket is built on the same platform as Cryptomus. Their sign = `md5(base64(body) + apiKey)` without any separator. Adding ":" causes `401 Invalid Sign` from the API.

## Amount unit

- `amount` sent from the frontend wallet is in **USD** (e.g. 10 = $10), NOT in credits/quota units.
- `HeleketUnitPrice` should be a **multiplier** (not divisor): `money = amount × unitPrice`. Default = 1.0 (1:1 USD).
- `HeleketMinTopUp` default = 1 (USD), not 500000 (credits). Using 500000 caused immediate server rejection.
- `getHeleketPayMoney` must use `Mul(unitPrice)` like FreeKassa uses `Mul(FreeKassaUnitPrice)`.

**How to apply:** Any future Heleket-compatible gateway integration should follow the same sign and amount conventions.
