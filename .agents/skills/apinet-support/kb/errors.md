---
name: Errors & Troubleshooting
description: HTTP error codes, error messages, rate limiting, channel auto-banning, sensitive content detection, and general troubleshooting steps.
---

# Errors & Troubleshooting

**Usage logs:** https://apinet.cloud/log
**Playground (test requests):** https://apinet.cloud/playground

## HTTP Status Codes

| Code | Meaning | Common Cause |
|---|---|---|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Invalid or missing API token |
| 403 | Forbidden | Token disabled, IP blocked, or no model access |
| 404 | Not Found | Model name doesn't exist |
| 413 | Request Too Large | Request body exceeds size limit |
| 429 | Too Many Requests | Rate limit hit |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | No available channel for the model |

## Error Messages Explained

### Quota / Access Errors

**"insufficient_user_quota"**
- User's balance is too low
- Fix: Top up at https://apinet.cloud/wallet or ask admin for quota

**"Token has no access to any models"**
- Token's model whitelist is set but no models match
- Fix: https://apinet.cloud/keys → Edit token → remove or update model restrictions

**"No available channel for model X in group Y"**
- No active channel supports this model for the user's group
- Fix (admin): https://apinet.cloud/channel → add/enable a channel, or check group assignment

### Request Validation Errors

**"model is required"**
- The API request body is missing the `model` field
- Fix: Add `"model": "gpt-4o"` (or desired model) to the request

**"field messages is required"**
- Chat completion request is missing the `messages` array
- Fix: Add `"messages": [{"role": "user", "content": "..."}]`

**"max_tokens is invalid"**
- The `max_tokens` value is out of range
- Fix: Use a reasonable value (e.g., 1–32768 depending on model)

**"please use 'x' instead of '×'"**
- Used the Unicode multiplication sign × instead of letter x in a size parameter
- Fix: Change `1024×1024` to `1024x1024`

### Content & Safety Errors

**"user sensitive words detected"**
- The request contains words from the system's sensitive word list
- Fix: Rephrase the request; contact admin if you believe it's a false positive

**"Current group load is saturated, please try again later"** (Midjourney)
- The Midjourney channel is at capacity
- Fix: Wait and retry; admin can add more Midjourney channels at https://apinet.cloud/channel

### Channel Errors (Admin)

**"channel:no_available_key"**
- All channels for the model are disabled/out of keys
- Fix: https://apinet.cloud/channel → re-enable channels or add new API keys

**"channel:invalid_key"**
- Upstream provider rejected the channel's API key
- Fix: https://apinet.cloud/channel → update the API key

**"channel:response_time_exceeded"**
- Upstream took too long to respond
- Fix: Retry the request; admin can increase timeout or add faster channels

**"model_not_found"**
- The requested model doesn't exist in any channel
- Fix: Check model name spelling; see available models at https://apinet.cloud/models

## Rate Limiting

| Level | Where Configured |
|---|---|
| Per-user RPM/RPD | https://apinet.cloud/user → Edit user |
| Per-token | https://apinet.cloud/keys → Edit token |
| Global | https://apinet.cloud/setting → Rate Limiting |

**Getting 429 errors?**
1. Wait 60 seconds and retry
2. Ask admin to increase your rate limit
3. Implement exponential backoff in your client code

## General Troubleshooting Steps

1. **Check the error message** — it usually tells you exactly what's wrong
2. **Check token status** at https://apinet.cloud/keys — enabled, not expired, not quota-exceeded
3. **Check channel status** at https://apinet.cloud/channel — channels for the model must be enabled
4. **Check user balance** at https://apinet.cloud/wallet — quota must be > 0
5. **Check Usage Logs** at https://apinet.cloud/log — shows exact error and quota consumed
6. **Test in Playground** at https://apinet.cloud/playground — isolate if it's a client issue
