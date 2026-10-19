---
name: Admin & User Management
description: User roles, creating and managing users, quota management, rate limits, system settings, dashboard, and admin-only operations.
---

# Admin & User Management

**Users panel:** https://apinet.cloud/user
**System Settings:** https://apinet.cloud/setting
**Dashboard:** https://apinet.cloud/dashboard

## User Roles

| Role | Capabilities |
|---|---|
| **Root** | Full access — system settings, all users, all channels, delete/create admins |
| **Admin** | Manage users (not root), channels, tokens, redemption codes. Cannot change system settings |
| **User** | Own tokens, own wallet, own usage logs only |

## Managing Users

**Creating a user manually:**
1. https://apinet.cloud/user → **Add User**
2. Set username, password, display name
3. Set group (Default, VIP, Free, etc.)
4. Set initial quota if needed

**Editing a user:**
1. https://apinet.cloud/user → find user → Edit (pencil icon)
2. Can change: password, group, quota, rate limits, enable/disable account, reset 2FA

**Disabling a user:**
- https://apinet.cloud/user → toggle the status switch — user cannot log in or make API calls

**Adding quota to a user:**
- https://apinet.cloud/user → Edit → Quota field → set new value (500,000 units = 1 USD)
- Or generate a redemption code at https://apinet.cloud/redemption and give it to the user

## Groups

Groups control pricing multipliers and model access:
1. https://apinet.cloud/setting → Groups → Add/Edit groups
2. Assign multipliers (1.0 = standard price; 0.5 = half price for VIP)
3. https://apinet.cloud/user → Edit user → change group

## Rate Limits

| Setting | Location |
|---|---|
| Global RPM | https://apinet.cloud/setting → Rate Limiting |
| Per-user RPM | https://apinet.cloud/user → Edit user → Rate Limit |
| Per-token | https://apinet.cloud/keys → Edit token |

Rate limit errors return HTTP 429.

## System Settings Overview

Navigate to **https://apinet.cloud/setting** (root only):

| Section | What's there |
|---|---|
| **General** | Site name, logo, footer, registration settings |
| **Operations** | Top-up amounts, payment gateways, quota gift on register |
| **Model Prices** | Per-model pricing ratios |
| **Rate Limiting** | Global request rate limits |
| **OAuth** | Social login provider configurations |
| **Email** | SMTP settings for email verification/notifications |
| **Monitoring** | Alert thresholds, notification webhooks |
| **Other** | Debug mode, log levels, performance settings |

## Dashboard & Analytics

**https://apinet.cloud/dashboard** (admin view):
- Total requests over time
- Quota consumption breakdown
- Channel health status
- Active users count
- Revenue metrics (if payment is configured)

**Usage Logs** at https://apinet.cloud/log (admin can filter all users):
- Filter by: date range, user, token, model, status
- Export as CSV for billing reconciliation

## Common Admin Tasks

### User can't access a model
1. Check which group the user is in at https://apinet.cloud/user
2. Check if any channel at https://apinet.cloud/channel supports that model for that group
3. Check if the user's token at https://apinet.cloud/keys has model restrictions

### User reports charges but no service
1. Check https://apinet.cloud/log for the user — find the specific request
2. Check if quota was refunded (logged as negative consumption)
3. If the request failed at channel level, quota should be refunded automatically

### Channel keeps getting auto-disabled
1. https://apinet.cloud/channel → find it → check the last error
2. Update the API key if it shows 401
3. Increase retry timeout if it shows timeout errors
4. Contact the upstream provider if their service is down

### Adding a new payment method
- https://apinet.cloud/setting → Operations → enable the desired gateway
- Enter the gateway's credentials (API keys, merchant ID, etc.)
- Test with a small amount before going live

### Generating redemption codes
1. https://apinet.cloud/redemption → Generate
2. Set quota value, count, optional expiry
3. Export as CSV and distribute to users
