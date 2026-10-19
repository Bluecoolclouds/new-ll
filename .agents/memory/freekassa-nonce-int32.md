---
name: FreeKassa nonce is int32-limited
description: FreeKassa API v2 (api.fk.life) stores the per-shop nonce as signed int32; sending a too-large nonce permanently locks the shop
---

# FreeKassa API v2 nonce constraint

The `nonce` field for `POST https://api.fk.life/v1/orders/create` is stored on
FreeKassa's side as a **signed int32** (max `2147483647`). The API requires each
new request to use a nonce **strictly greater** than the highest previously seen
value for that shop.

**The trap:** If any request ever sends a nonce larger than int32 max
(e.g. `Date.now()` milliseconds ~1.78e12 from FreeKassa's own JS SDK, or
`time.UnixMilli()`/`UnixNano()`), FreeKassa **clamps it to int32 max
(2147483647)** and stores that as the high-water mark. After that, NO nonce can
ever beat it — every request fails with:
`{"type":"error","message":"Request with same (or bigger) nonce already exist"}`.
The shop's nonce counter is permanently stuck.

**Why:** Verified empirically by probing the live API with shop 73538 — nonces of
1.78e9, 1.78e12, 1.78e18, 9e18, and exactly 2147483647 ALL returned the same
"same or bigger nonce already exist" error, proving the stored value sits at the
int32 ceiling and larger values get clamped down to it.

**How to apply:**
- ALWAYS use `time.Now().Unix()` (seconds, ~1.78e9) for the nonce — it stays well
  inside int32 and increases monotonically until the Y2038 limit. NEVER use
  UnixMilli / UnixNano / Date.now() — they overflow int32 and brick the shop.
- Recovery once locked is NOT possible in code. The merchant must **regenerate
  the API key** in the FreeKassa cabinet (Settings → API), which resets the nonce
  counter to 0, or contact FreeKassa support to reset the nonce for the shop.
- Code location: `controller/topup_freekassa.go`, `requestFreeKassaPayViaAPI`.
- Signature is confirmed correct: HMAC-SHA256 over request field values sorted by
  key alphabetically and joined with `|`, secret = API key.
