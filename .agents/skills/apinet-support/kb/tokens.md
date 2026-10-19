---
name: API Tokens
description: Creating and managing API tokens (keys), quota limits, model restrictions, IP whitelisting, expiration, and token-related access errors.
---

# API Tokens (Keys)

**Manage tokens:** https://apinet.cloud/keys

Tokens are what users put in their API clients as the `Authorization: Bearer <token>` header. Each token can have fine-grained restrictions.

## Creating a Token

1. Go to **https://apinet.cloud/keys**
2. Click **Add Token**
3. Configure:
   - **Name** — label for the token
   - **Quota limit** — max quota this token can consume (0 = unlimited, uses account balance)
   - **Expiration** — optional expiry date
   - **Model restrictions** — whitelist specific models (leave empty = all allowed)
   - **IP whitelist** — restrict to specific IPs/CIDR ranges (leave empty = all IPs)
4. Click **Submit** — copy the token immediately, it won't be shown again

## Token Format

Tokens start with `sk-` followed by a random string, e.g.:
```
sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Common Token Issues

### "Token has no access to any models"
- The token has a model whitelist set, but the requested model isn't in it
- **Fix:** https://apinet.cloud/keys → Edit token → remove model restrictions or add the model

### "Token is not allowed to use model: [name]"
- Same as above, but for a specific model name
- **Fix:** https://apinet.cloud/keys → Edit token → add the model to the allowed list

### "Insufficient user quota"
- The token's quota limit is reached, or the account balance is 0
- **Fix:** Top up at https://apinet.cloud/wallet, or increase the token's quota limit

### "Token expired"
- The token's expiration date has passed
- **Fix:** https://apinet.cloud/keys → create a new token or edit existing one to extend expiry

### "Token is disabled"
- An admin manually disabled the token
- **Fix:** https://apinet.cloud/keys → click the status toggle to re-enable

### Token not working at all (401 Unauthorized)
1. Check the token is copied correctly (no extra spaces)
2. Ensure the Authorization header format is: `Bearer sk-xxxxx`
3. Check token status at https://apinet.cloud/keys — must be **Enabled**
4. Verify the token hasn't expired

## API Endpoint

The base URL for all API calls through APINET.CLOUD:
```
https://apinet.cloud/v1
```
Use this as the `base_url` in any OpenAI-compatible client.
