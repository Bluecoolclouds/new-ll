---
name: MiniMax max_tokens cap
description: MiniMax API enforces max_tokens in [1, 32768]; adaptor caps the value to prevent 400 errors.
---

# MiniMax max_tokens cap

**Rule:** MiniMax API (including MiniMax-M2.5 and other M-series models) only accepts `max_tokens` in the range [1, 32768]. Sending a larger value returns HTTP 400 with `InternalError.Algo.InvalidParameter: Range of max_tokens should be [1, 32768]`.

**Why this happens:** Channel `param_override` can inject a global `max_tokens` value (e.g. 65536) into all requests. When that channel routes to MiniMax, the injected value exceeds the limit.

**Fix applied:** `relay/channel/minimax/adaptor.go` → `ConvertOpenAIRequest` silently clamps any `max_tokens > 32768` down to `32768` before forwarding.

**How to apply:** No action needed — the cap is automatic. If a user explicitly sends `max_tokens: 100000` to a MiniMax model, it will be silently reduced to 32768.
