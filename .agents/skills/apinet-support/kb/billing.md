---
name: Billing & Wallet
description: Quota system, wallet top-up, payment gateways (Stripe, EPay, FreeKassa, Creem, Waffo), redemption codes, usage logs, and pricing ratios.
---

# Billing & Wallet

**Wallet & top-up:** https://apinet.cloud/wallet
**Usage logs:** https://apinet.cloud/log

## Quota System

- **Base ratio:** 1 USD = 500,000 quota units
- Quota is displayed in USD equivalent in the UI
- Each model has a pricing ratio — more powerful models cost more quota per token
- Quota is consumed per request based on: `(input_tokens + output_tokens) × model_ratio`

## Checking Your Balance

- **User:** https://apinet.cloud/wallet — shows current balance and usage history
- **Admin:** https://apinet.cloud/user → click a user → see their quota
- **Via API:** `GET https://apinet.cloud/api/user/self` — returns `quota` field

## Topping Up (Users)

1. Go to **https://apinet.cloud/wallet**
2. Click **Top Up**
3. Select amount
4. Choose payment method:
   - **Stripe** — credit/debit cards (global)
   - **EPay** — China payment aggregator (Alipay, WeChat Pay)
   - **FreeKassa** — Russian payment system
   - **Creem** — global payments
   - **Waffo** — global payments
5. Complete payment — quota is credited automatically

## Redemption Codes

**Redeem a code:**
1. Go to **https://apinet.cloud/wallet**
2. Click **Redeem Code**
3. Enter the code → click **Redeem** — quota is added immediately

**Code doesn't work?**
- Code may already be used (each code is single-use unless batch)
- Code may be expired
- Check for typos — codes are case-sensitive
- Contact admin if code should be valid

## Redemption Codes (Admin)

1. Go to **https://apinet.cloud/redemption**
2. Click **Generate**
3. Set quota value, count, and optional expiry
4. Export generated codes as CSV

## Usage Logs

- **Users:** https://apinet.cloud/log — filter by date, model, token
- **Admins:** same page, but can filter by any user
- Export as CSV for billing reconciliation

## Model Pricing

Admins can view and edit per-model pricing ratios at:
**https://apinet.cloud/setting** → Model Prices
