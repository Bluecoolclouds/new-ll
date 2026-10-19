---
name: Custom APINET components
description: List of custom APINET.CLOUD features and files that must be preserved during upstream (new-api) merges and never overwritten.
---

## RedemptionCodeCard — "ЕСТЬ КОД?"

UI card on the wallet page with a redemption code input ("Введите код активации") and button ("Обменять кредиты"). Displayed in the **left column** of the custom 2-column wallet layout.

- File: `web/default/src/features/wallet/components/redemption-code-card.tsx`
- Rendered in: `web/default/src/features/wallet/index.tsx` (left column, below AffiliateRewardsCard)

**Why:** Upstream merges repeatedly destroy the custom wallet layout. This card is a core APINET feature and must always be present in the left column.

## Custom 2-column Wallet Layout

`web/default/src/features/wallet/index.tsx` — left: stats + SubscriptionPlansCard + AffiliateRewardsCard + RedemptionCodeCard; right: RechargeFormCard (max-w-lg). Was destroyed by upstream commit `22f7eee9`; must be manually restored after every merge.

## FreeKassa Payment

- `controller/topup_freekassa.go` — payment handlers (RequestFreeKassaAmount, RequestFreeKassaPay)
- `controller/topup_cbr.go` — CBR USD/RUB rate fetcher
- `setting/payment_freekassa.go` — admin settings
- Routes registered in `router/api-router.go`: `POST /api/user/freekassa/amount` and `POST /api/user/freekassa/pay`
- Enable condition: `isFreeKassaTopUpEnabled()` in `controller/payment_webhook_availability.go`

## Branding

- System name: `APINET.CLOUD` (in `common/constants.go` and `web/default/src/lib/constants.ts`)
- Logo: `web/default/src/assets/logo.tsx`
- Footer: `web/default/src/components/layout/components/footer.tsx` — name is plain text, no GitHub link
- About page: `web/default/src/features/about/index.tsx` — GitHub links removed
- Support link: `https://t.me/wpnetwork_sup` (in `web/default/src/features/errors/general-error.tsx`)

## Default Theme Settings

Set in code (not DB). New visitors always get these until they change manually (saved in cookies for 1 year):
- Theme: `light` (`web/default/src/context/theme-provider.tsx`)
- Font: `sans` (`web/default/src/lib/theme-customization.ts`)
- Sidebar: `floating` (`web/default/src/context/layout-provider.tsx`)
- Preset: `default`, radius: `default`, scale: `default`, content: `full`

**Why:** User explicitly requested these as permanent defaults for all new visitors.

## Build Pipeline

```
npm --prefix web/default run build
sleep 25 && go build -o new-api .   # sleep needed to avoid git index.lock
```
Then restart workflow "Start application".
