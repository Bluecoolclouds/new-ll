---
name: Payment gateway pattern
description: Checklist of all files to touch when adding a new payment method (Heleket as canonical example)
---

# Adding a new payment gateway

**Why:** Every gateway requires coordinated changes across ~15 files. Missing any one causes compile errors or silent UI failures.

## Backend files

| File | What to do |
|------|-----------|
| `model/topup.go` | Add `PaymentMethodXxx` + `PaymentProviderXxx` constants; add `RechargeXxx(tradeNo, callerIp)` |
| `setting/payment_xxx.go` | New file: settings vars + `LoadXxxSettings()` |
| `controller/topup_xxx.go` | New file: `XxxAmount`, `XxxPay`, `XxxWebhook` handlers |
| `controller/payment_webhook_availability.go` | Add `isXxxTopUpEnabled()` |
| `controller/topup.go` | Add method to `payMethods`, add `enable_xxx_topup` + `xxx_min_topup` to data map |
| `router/api-router.go` | Register `/api/user/xxx/amount`, `/api/user/xxx/pay`, `/api/xxx/webhook` |

**Critical:** `system_setting.ServerAddress` (not `common.ServerAddress`) for webhook callback URL construction.

## Frontend files

| File | What to do |
|------|-----------|
| `wallet/constants.ts` | Add `PAYMENT_TYPES.XXX`, add color to `PAYMENT_COLORS` |
| `wallet/types.ts` | Add `XxxPaymentRequest/Response`; add `enable_xxx_topup` + `xxx_min_topup` to `TopupInfo` |
| `wallet/api.ts` | Add `calculateXxxAmount()` + `requestXxxPayment()` (import types too) |
| `wallet/lib/payment.ts` | Add `isXxxPayment()` helper; add branch in `getMinTopupAmount()` |
| `wallet/hooks/use-payment.ts` | Import helpers + API fns; add isXxx branch in both `calculatePaymentAmount` and `processPayment` |
| `wallet/components/recharge-form-card.tsx` | Add prop `enableXxxTopup?`, add to `hasConfigurableTopup`, add to `allMethodCards`, add icon branch, add to `getMethodSubtitle` |
| `wallet/index.tsx` | Pass `enableXxxTopup={topupInfo?.enable_xxx_topup}` to `RechargeFormCard` |

## Admin settings files

| File | What to do |
|------|-----------|
| `system-settings/integrations/xxx-settings-section.tsx` | New file: zod schema + form; use `div`+`h3` not `SettingsForm.Section` (doesn't exist) |
| `system-settings/integrations/payment-settings-section.tsx` | Import section + type; add `xxxDefaultValues` to Props + render `<XxxSettingsSection>` after a `<Separator />` |
| `system-settings/billing/section-registry.tsx` | Pass `xxxDefaultValues={{ ... }}` with defaults to `PaymentSettingsSection` |
| `system-settings/types.ts` (BillingSettings) | Add all settings fields (ApiKey, etc.) |

**How to apply:** Follow this checklist top-to-bottom for every new gateway. Build both Go and frontend after.
