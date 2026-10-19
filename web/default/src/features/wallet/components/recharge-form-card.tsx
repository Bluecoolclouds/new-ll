/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState, useEffect, useMemo } from 'react'
import { Gift, ExternalLink, Loader2, Receipt, WalletCards, ArrowRight, Zap, TrendingUp, CreditCard, Coins, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatCurrency,
  formatQuotaShort,
  getPaymentIcon,
  getMinTopupAmount,
} from '../lib'
import { QUOTA_PER_DOLLAR, DEFAULT_DISCOUNT_RATE } from '../constants'
import type {
  PaymentMethod,
  PresetAmount,
  TopupInfo,
  CreemProduct,
  WaffoPayMethod,
} from '../types'
import { CreemProductsSection } from './creem-products-section'

// ============================================================================
// Crypto Coins List
// ============================================================================

const FREEKASSA_CRYPTO_COINS = [
  { id: '24', name: 'Bitcoin',      symbol: 'BTC',  range: '0.0001–20' },
  { id: '25', name: 'Litecoin',     symbol: 'LTC',  range: '0.01–1000' },
  { id: '26', name: 'Ethereum',     symbol: 'ETH',  range: '0.0001–1000' },
  { id: '14', name: 'USDT (ERC20)', symbol: 'USDT', range: '10–100000' },
  { id: '15', name: 'USDT (TRC20)', symbol: 'USDT', range: '2.5–100000' },
  { id: '45', name: 'TON',          symbol: 'TON',  range: '0.1–100000' },
  { id: '17', name: 'BNB',          symbol: 'BNB',  range: '0.01–10000' },
  { id: '39', name: 'Tron',         symbol: 'TRX',  range: '10–100000' },
] as const

// ============================================================================
// Method Subtitle Helper
// ============================================================================

function getMethodSubtitle(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    alipay: t('Alipay'),
    wxpay: t('WeChat Pay'),
    stripe: t('Card / Bank'),
    freekassa: t('SBP / Fast Pay'),
    freekassa_card: t('Visa / MC / Mir'),
    freekassa_crypto: t('USDT / BTC / ETH'),
    freekassa_id32: t('VISA/MASTERCARD USD WORLD'),
    waffo: t('Waffo Pay'),
    waffo_pancake: t('Waffo'),
    creem: t('Creem'),
    heleket: t('Cryptocurrency'),
    pally: t('СБП / Карта (RUB)'),
    plategal: t('СБП / Карта (RUB)'),
    plategal_sbp: t('Быстрый перевод (RUB)'),
    plategal_card: t('МИР'),
    plategal_intl: t('VISA / Mastercard'),
  }
  return map[type] || ''
}

// ============================================================================
// Summary Row Component
// ============================================================================

function SummaryRow({
  label,
  value,
  highlight,
  muted,
}: {
  label: string
  value: string
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div className='flex items-center justify-between gap-2'>
      <span className={cn('text-sm', muted ? 'text-muted-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span
        className={cn(
          'text-sm font-medium',
          highlight && 'text-green-600 dark:text-green-400'
        )}
      >
        {value}
      </span>
    </div>
  )
}

// ============================================================================
// Payment Method Card Component
// ============================================================================

function MethodCard({
  icon,
  name,
  subtitle,
  selected,
  disabled,
  loading,
  onClick,
}: {
  icon: React.ReactNode
  name: string
  subtitle?: string
  selected: boolean
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-foreground bg-foreground text-background shadow-sm'
          : 'border-border bg-background text-foreground hover:border-foreground/40 hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      {loading ? (
        <Loader2 className='h-4 w-4 animate-spin' />
      ) : (
        <span className={cn(
          'flex-shrink-0 [&>svg]:h-5 [&>svg]:w-5 [&>img]:h-5 [&>img]:w-5',
          selected ? '[&>svg]:text-background [&>img]:brightness-0 [&>img]:invert' : ''
        )}>
          {icon}
        </span>
      )}
      <span className='text-sm font-semibold leading-none whitespace-nowrap'>{name}</span>
      {subtitle && (
        <span className={cn(
          'text-xs leading-none whitespace-nowrap',
          selected ? 'text-background/70' : 'text-muted-foreground'
        )}>
          · {subtitle}
        </span>
      )}
    </button>
  )
}

// ============================================================================
// Props
// ============================================================================

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  topupAmount: number
  onTopupAmountChange: (amount: number) => void
  paymentAmount: number
  calculating: boolean
  onPaymentMethodSelect: (method: PaymentMethod) => void
  onMethodChange?: (method: PaymentMethod) => void
  paymentLoading: string | null
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
  loading?: boolean
  priceRatio?: number
  usdExchangeRate?: number
  discountRate?: number
  onOpenBilling?: () => void
  creemProducts?: CreemProduct[]
  enableCreemTopup?: boolean
  onCreemProductSelect?: (product: CreemProduct) => void
  enableWaffoTopup?: boolean
  waffoPayMethods?: WaffoPayMethod[]
  waffoMinTopup?: number
  onWaffoMethodSelect?: (method: WaffoPayMethod, index: number) => void
  enableWaffoPancakeTopup?: boolean
  enableFreeKassaTopup?: boolean
  freekassaCardEnabled?: boolean
  freekassaCryptoEnabled?: boolean
  freekassaID32Enabled?: boolean
  freekassaID32Name?: string
  rawUsdExchangeRate?: number
  freekassaUnitPrice?: number
  freekassaCbrRate?: number
  enableHeleketTopup?: boolean
  enablePallyTopup?: boolean
  enablePlategalTopup?: boolean
  enablePlategalSBP?: boolean
  enablePlategalCard?: boolean
  enablePlategalIntl?: boolean
}

// ============================================================================
// Main Component
// ============================================================================

export function RechargeFormCard({
  topupInfo,
  presetAmounts,
  selectedPreset,
  onSelectPreset,
  topupAmount,
  onTopupAmountChange,
  paymentAmount,
  calculating,
  onPaymentMethodSelect,
  onMethodChange,
  paymentLoading,
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
  topupLink,
  loading,
  priceRatio = 1,
  usdExchangeRate = 1,
  discountRate = DEFAULT_DISCOUNT_RATE,
  onOpenBilling,
  creemProducts,
  enableCreemTopup,
  onCreemProductSelect,
  enableWaffoTopup,
  waffoPayMethods,
  waffoMinTopup,
  onWaffoMethodSelect,
  enableWaffoPancakeTopup,
  enableFreeKassaTopup,
  freekassaCardEnabled,
  freekassaCryptoEnabled,
  freekassaID32Enabled,
  freekassaID32Name,
  rawUsdExchangeRate = 1,
  freekassaUnitPrice = 0,
  freekassaCbrRate = 0,
  enableHeleketTopup,
  enablePallyTopup,
  enablePlategalTopup,
  enablePlategalSBP,
  enablePlategalCard,
  enablePlategalIntl,
}: RechargeFormCardProps) {
  const { t } = useTranslation()

  // Use rawUsdExchangeRate (always the actual RUB rate, even in USD-display mode)
  const rubRate = rawUsdExchangeRate > 1 ? rawUsdExchangeRate : usdExchangeRate

  const [localAmount, setLocalAmount] = useState(topupAmount.toString())
  const [localSelectedMethod, setLocalSelectedMethod] = useState<PaymentMethod | null>(null)
  const [localCurrency, setLocalCurrency] = useState<'rub' | 'usd'>(
    rubRate > 1 ? 'rub' : 'usd'
  )

  // USD mode with FreeKassa: user enters real-dollar payment, gets more credits back
  const isFreekassaUsdMode =
    localCurrency === 'usd' &&
    localSelectedMethod?.type === 'freekassa' &&
    freekassaCbrRate > 0 &&
    freekassaUnitPrice > 0

  const displaySymbol = localCurrency === 'rub' ? '₽' : '$'
  const showCurrencyToggle = rubRate > 1

  // toDisplay: credits (USD) → display amount
  const toDisplay = (usdAmount: number) => {
    if (localCurrency === 'rub' && rubRate > 1) return Math.round(usdAmount * rubRate)
    if (isFreekassaUsdMode) return parseFloat((usdAmount * freekassaUnitPrice / freekassaCbrRate).toFixed(2))
    return usdAmount
  }
  // toBase: display amount → credits (USD)
  const toBase = (displayAmount: number) => {
    if (localCurrency === 'rub' && rubRate > 1) return displayAmount / rubRate
    if (isFreekassaUsdMode) return displayAmount * freekassaCbrRate / freekassaUnitPrice
    return displayAmount
  }

  useEffect(() => {
    let display: number
    if (localCurrency === 'rub' && rubRate > 1) {
      display = Math.round(topupAmount * rubRate)
    } else if (localCurrency === 'usd' && localSelectedMethod?.type === 'freekassa' && freekassaCbrRate > 0 && freekassaUnitPrice > 0) {
      display = parseFloat((topupAmount * freekassaUnitPrice / freekassaCbrRate).toFixed(2))
    } else {
      display = topupAmount
    }
    setLocalAmount(display.toString())
  }, [topupAmount, localCurrency, rubRate, localSelectedMethod?.type, freekassaCbrRate, freekassaUnitPrice])

  const hasConfigurableTopup =
    topupInfo?.enable_online_topup ||
    topupInfo?.enable_stripe_topup ||
    enableWaffoTopup ||
    enableWaffoPancakeTopup ||
    enableFreeKassaTopup ||
    enableHeleketTopup ||
    enablePallyTopup ||
    enablePlategalTopup ||
    enablePlategalSBP ||
    enablePlategalCard ||
    enablePlategalIntl
  const hasAnyTopup = hasConfigurableTopup || enableCreemTopup
  const hasStandardPaymentMethods =
    Array.isArray(topupInfo?.pay_methods) && topupInfo.pay_methods.length > 0
  const hasWaffoPaymentMethods =
    Array.isArray(waffoPayMethods) && waffoPayMethods.length > 0
  // For RUB-native gateways (FreeKassa, Pally), min_topup is stored in RUB.
  // Convert to credits so toDisplay(credits) = credits * rubRate = minRub
  const minTopup = useMemo(() => {
    if (localCurrency === 'rub' && rubRate > 1 && topupInfo) {
      if (topupInfo.enable_freekassa_topup && topupInfo.freekassa_min_topup) {
        return topupInfo.freekassa_min_topup / rubRate
      }
      if (topupInfo.enable_pally_topup && topupInfo.pally_min_topup) {
        return topupInfo.pally_min_topup / rubRate
      }
    }
    return getMinTopupAmount(topupInfo)
  }, [topupInfo, localCurrency, rubRate])
  const maxTopup =
    localCurrency === 'rub' && rubRate > 1
      ? Math.round(20000 / rubRate)
      : Math.max(minTopup * 200, 10000)
  const redemptionEnabled = topupInfo?.enable_redemption !== false

  // Build unified methods list
  const allMethodCards = useMemo(() => {
    const methods: { method: PaymentMethod; waffoIndex?: number }[] = []

    if (enablePlategalCard) {
      methods.push({
        method: { type: 'plategal_card', name: t('Банковская карта (МИР)') },
      })
    }

    if (enablePlategalIntl) {
      methods.push({
        method: { type: 'plategal_intl', name: t('Международные платежи') },
      })
    }

    if (enablePlategalTopup && !enablePlategalSBP && !enablePlategalCard && !enablePlategalIntl) {
      methods.push({
        method: { type: 'plategal', name: 'Platega' },
      })
    }

    if (enablePallyTopup) {
      methods.push({
        method: { type: 'pally', name: 'Pally' },
      })
    }

    if (enableFreeKassaTopup) {
      methods.push({
        method: { type: 'freekassa', name: 'СБП' },
      })
    }

    if (freekassaCardEnabled) {
      methods.push({
        method: { type: 'freekassa_card', name: t('Cards') },
      })
    }

    if (freekassaCryptoEnabled) {
      methods.push({
        method: { type: 'freekassa_crypto', name: t('Crypto') },
      })
    }

    if (freekassaID32Enabled) {
      methods.push({
        method: { type: 'freekassa_id32', name: freekassaID32Name || 'Кассир.ру' },
      })
    }

    if (enableHeleketTopup) {
      methods.push({
        method: { type: 'heleket', name: 'Heleket' },
      })
    }

    return methods
  }, [enableFreeKassaTopup, freekassaCardEnabled, freekassaCryptoEnabled, freekassaID32Enabled, freekassaID32Name, enableHeleketTopup, enablePallyTopup, enablePlategalTopup, enablePlategalSBP, enablePlategalCard, enablePlategalIntl, t])

  const handleAmountChange = (value: string) => {
    setLocalAmount(value)
    const numValue = parseFloat(value) || 0
    if (numValue >= 0) {
      onTopupAmountChange(toBase(numValue))
    }
  }

  const handleSliderChange = (value: number) => {
    setLocalAmount(value.toString())
    onTopupAmountChange(toBase(value))
  }

  const handleCurrencySwitch = (c: 'rub' | 'usd') => {
    setLocalCurrency(c)
    // Let the useEffect recalculate localAmount based on new currency + mode
    const isFkUsd = c === 'usd' && localSelectedMethod?.type === 'freekassa' && freekassaCbrRate > 0 && freekassaUnitPrice > 0
    let newDisplayAmt: number
    if (c === 'rub' && rubRate > 1) {
      newDisplayAmt = Math.round(topupAmount * rubRate)
    } else if (isFkUsd) {
      newDisplayAmt = parseFloat((topupAmount * freekassaUnitPrice / freekassaCbrRate).toFixed(2))
    } else {
      newDisplayAmt = topupAmount
    }
    setLocalAmount(newDisplayAmt.toString())
  }

  // Auto-select first available method so calculations use the correct payment type
  useEffect(() => {
    if (allMethodCards.length > 0 && !localSelectedMethod) {
      const first = allMethodCards[0]
      setLocalSelectedMethod(first.method)
      if (onMethodChange) onMethodChange(first.method)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMethodCards.length])

  const handleMethodCardClick = (method: PaymentMethod, waffoIndex?: number) => {
    // For crypto parent, auto-select first coin and expand sub-list
    if (method.type === 'freekassa_crypto') {
      const first = FREEKASSA_CRYPTO_COINS[0]
      const subMethod: PaymentMethod = { type: `freekassa_crypto_${first.id}`, name: first.name }
      setLocalSelectedMethod(subMethod)
      if (onMethodChange) onMethodChange(subMethod)
      return
    }

    setLocalSelectedMethod(method)

    // For waffo sub-methods, trigger directly
    if (waffoIndex !== undefined && onWaffoMethodSelect && waffoPayMethods) {
      onWaffoMethodSelect(waffoPayMethods[waffoIndex], waffoIndex)
      return
    }

    // Notify parent to recalculate (no dialog)
    if (onMethodChange) {
      onMethodChange(method)
    }
  }

  const handleCryptoSubSelect = (coin: { readonly id: string; readonly name: string; readonly symbol: string; readonly range: string }) => {
    const subMethod: PaymentMethod = { type: `freekassa_crypto_${coin.id}`, name: coin.name }
    setLocalSelectedMethod(subMethod)
    if (onMethodChange) onMethodChange(subMethod)
  }

  const handleProceedToPayment = () => {
    if (!localSelectedMethod) return
    // This triggers the full payment flow (confirm dialog, etc.)
    onPaymentMethodSelect(localSelectedMethod)
  }

  // ── Summary calculations ───────────────────────────────────────────────
  const bonusPct =
    discountRate < DEFAULT_DISCOUNT_RATE
      ? Math.round((1 - discountRate) * 100)
      : 0

  // Savings in display currency, computed from topup amount × discount fraction.
  // Does NOT depend on paymentAmount so it works even when the backend amount
  // calculation returns 0 (e.g. FreeKassa with non-integer USD amounts).
  const savingsDisplayAmount =
    discountRate < DEFAULT_DISCOUNT_RATE && topupAmount > 0
      ? Math.round(toDisplay(topupAmount) * (1 - discountRate))
      : null

  const totalCredits = topupAmount * QUOTA_PER_DOLLAR
  const totalCreditsM = totalCredits / 1_000_000
  const ratePerMillion =
    totalCreditsM > 0 && paymentAmount > 0
      ? paymentAmount / totalCreditsM
      : null

  const isRubGateway =
    localSelectedMethod != null &&
    ['plategal_card', 'plategal_intl', 'plategal_sbp', 'plategal', 'pally',
     'freekassa', 'freekassa_card'].includes(localSelectedMethod.type)

  // Real gateway rate: RUB per 1 USD of credits (from actual backend calculation)
  const rubPerDollar =
    isRubGateway && paymentAmount > 0 && topupAmount > 0
      ? paymentAmount / topupAmount
      : null

  const canProceed =
    !!localSelectedMethod &&
    topupAmount >= minTopup &&
    !paymentLoading &&
    !calculating

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4 p-3 sm:space-y-6 sm:p-5'>
          <div className='flex gap-3 overflow-hidden'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-[88px] w-[76px] flex-shrink-0 rounded-xl' />
            ))}
          </div>
          <div className='grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]'>
            <div className='space-y-3'>
              <Skeleton className='h-3 w-28' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-4 w-full rounded-full' />
              <div className='grid grid-cols-4 gap-2'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-8 rounded-lg' />
                ))}
              </div>
            </div>
            <Skeleton className='h-[200px] rounded-xl' />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-3'>

      {/* ── Header strip ─────────────────────────────────────────── */}
      <div className='flex items-center justify-between px-1'>
        <div className='flex items-center gap-2.5'>
          <div className='bg-foreground flex h-7 w-7 items-center justify-center rounded-lg'>
            <WalletCards className='text-background h-3.5 w-3.5' />
          </div>
          <span className='text-sm font-semibold'>{t('Add Funds')}</span>
        </div>
        {onOpenBilling && (
          <button
            type='button'
            onClick={onOpenBilling}
            className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors'
          >
            <Receipt className='h-3.5 w-3.5' />
            {t('Order History')}
          </button>
        )}
      </div>

      {hasAnyTopup ? (
        <>
          {hasConfigurableTopup && (
            <>
              {/* ── 1. AMOUNT CARD (dark band) ───────────────────────── */}
              <Card className='gap-0 overflow-hidden py-0 shadow-sm'>
                <div className='from-foreground to-foreground/80 bg-gradient-to-br px-5 pb-4 pt-5'>
                  {/* Row: label + currency toggle */}
                  <div className='mb-4 flex items-start justify-between'>
                    <p className='text-background/60 text-xs font-medium uppercase tracking-wider'>
                      {t('Top Up Amount')}
                    </p>
                    {showCurrencyToggle && (
                      <div className='bg-background/10 inline-flex gap-0.5 rounded-lg p-0.5'>
                        {(['rub', 'usd'] as const).map((c) => (
                          <button
                            key={c}
                            type='button'
                            onClick={() => handleCurrencySwitch(c)}
                            className={cn(
                              'rounded-md px-3 py-1 text-xs font-semibold transition-all',
                              localCurrency === c
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-background/60 hover:text-background'
                            )}
                          >
                            {c === 'rub' ? '₽' : '$'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Big bare input */}
                  <div className='relative mb-5 flex items-baseline gap-1'>
                    <input
                      id='topup-amount'
                      type='number'
                      value={localAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      min={toDisplay(minTopup)}
                      placeholder='0'
                      className={cn(
                        'text-background w-full bg-transparent text-4xl font-bold tabular-nums tracking-tight',
                        'placeholder:text-background/30 placeholder:text-2xl placeholder:font-light',
                        'focus:outline-none',
                        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                      )}
                    />
                    <span className='text-background/70 shrink-0 text-xl font-semibold'>
                      {displaySymbol}
                    </span>
                  </div>

                  {/* Slider */}
                  <input
                    type='range'
                    min={toDisplay(minTopup)}
                    max={toDisplay(maxTopup)}
                    step={localCurrency === 'rub' ? Math.round(rubRate) : isFreekassaUsdMode ? 0.5 : 1}
                    value={Math.min(
                      Math.max(toDisplay(topupAmount), toDisplay(minTopup)),
                      toDisplay(maxTopup)
                    )}
                    onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                    className='w-full cursor-pointer'
                    style={{ height: '3px', accentColor: 'white', opacity: 0.8 }}
                  />
                  <div className='text-background/40 mt-1 flex justify-between text-[10px]'>
                    <span>{toDisplay(minTopup).toLocaleString()}{displaySymbol}</span>
                    <span>{toDisplay(maxTopup).toLocaleString()}{displaySymbol}</span>
                  </div>
                </div>

                {/* Preset cards */}
                {presetAmounts.length > 0 && (
                  <CardContent className='px-4 pb-4 pt-1'>
                    <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                      {presetAmounts.slice(0, 8).map((preset) => {
                        const displayAmt = toDisplay(preset.value)
                        const hasPresetDiscount =
                          preset.discount != null && preset.discount < 1
                        const discountPct = hasPresetDiscount
                          ? Math.round((1 - preset.discount!) * 100)
                          : 0
                        const savingsAmt = hasPresetDiscount
                          ? Math.round(displayAmt * (1 - preset.discount!))
                          : 0
                        const isSelected = selectedPreset === preset.value

                        // payAmt: what the user actually pays in local currency
                        // For RUB gateways: use real gateway rate (not generic rubRate)
                        const rubPayAmt = rubPerDollar != null
                          ? Math.round(rubPerDollar * preset.value * (hasPresetDiscount ? preset.discount! : 1))
                          : null
                        const payAmt = hasPresetDiscount
                          ? Math.round(displayAmt * preset.discount!)
                          : displayAmt

                        return (
                          <div key={preset.value} className='relative'>
                            {hasPresetDiscount && (
                              <span className='absolute -right-1.5 -top-1.5 z-10 inline-flex items-center rounded-full bg-emerald-500 px-1.5 py-px text-[10px] font-bold leading-4 text-white shadow'>
                                -{discountPct}%
                              </span>
                            )}
                            <button
                              type='button'
                              onClick={() => onSelectPreset(preset)}
                              className={cn(
                                'w-full rounded-xl border p-3 text-left transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
                              )}
                            >
                              {/* USD credits the user receives */}
                              <div className={cn(
                                'flex items-center gap-1.5 font-bold',
                                isSelected ? 'text-primary' : 'text-foreground'
                              )}>
                                <DollarSign className='h-4 w-4 shrink-0' />
                                <span className='text-base tabular-nums'>
                                  {preset.value} USD
                                </span>
                              </div>
                              {/* Payment info in local currency */}
                              <div className='mt-2 space-y-0.5'>
                                <div className='text-[11px] leading-tight text-muted-foreground'>
                                  {t('preset_pay_label', {
                                    amount: rubPayAmt != null
                                      ? `₽${rubPayAmt}`
                                      : `${displaySymbol}${hasPresetDiscount ? payAmt : displayAmt}`
                                  })}
                                </div>
                                {hasPresetDiscount && (
                                  <div className='text-[10px] leading-tight text-emerald-500 font-medium'>
                                    {t('preset_save_label', {
                                      savings: rubPerDollar != null
                                        ? `₽${Math.round(rubPerDollar * preset.value * (1 - preset.discount!))}`
                                        : `${displaySymbol}${savingsAmt}`
                                    })}
                                  </div>
                                )}
                              </div>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* ── 2. METHOD CARD ───────────────────────────────────── */}
              {allMethodCards.length > 0 && (
                <Card className='gap-0 py-0 shadow-sm'>
                  <CardContent className='p-4'>
                    <p className='text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider'>
                      {t('Payment Method')}
                    </p>
                    <div className='flex flex-col gap-2'>
                      {allMethodCards.map(({ method, waffoIndex }) => {
                        const methodMin =
                          method.min_topup ||
                          (method.type.startsWith('waffo-') ? waffoMinTopup : 0) ||
                          0
                        const disabled = methodMin > topupAmount
                        const isCryptoParent = method.type === 'freekassa_crypto'
                        const isSelected = isCryptoParent
                          ? !!localSelectedMethod?.type.startsWith('freekassa_crypto')
                          : localSelectedMethod?.type === method.type
                        const cryptoExpanded = isCryptoParent && !!localSelectedMethod?.type.startsWith('freekassa_crypto')
                        const selectedCryptoSubId = localSelectedMethod?.type.startsWith('freekassa_crypto_')
                          ? localSelectedMethod.type.replace('freekassa_crypto_', '')
                          : null
                        const isLoading =
                          paymentLoading === method.type ||
                          (waffoIndex !== undefined &&
                            paymentLoading === `waffo-${waffoIndex}`)
                        const subtitle = getMethodSubtitle(
                          method.type.startsWith('waffo-') ? 'waffo' : method.type,
                          t
                        )
                        return (
                          <div key={method.type} className='flex flex-col gap-1'>
                            <button
                              type='button'
                              disabled={disabled}
                              onClick={() => !disabled && handleMethodCardClick(method, waffoIndex)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                                isSelected
                                  ? 'border-foreground bg-foreground/5 ring-1 ring-foreground/10'
                                  : 'border-border hover:border-foreground/30',
                                disabled && 'cursor-not-allowed opacity-40'
                              )}
                            >
                              <div className='bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
                                {isLoading ? (
                                  <Loader2 className='h-4 w-4 animate-spin' />
                                ) : method.type === 'freekassa' ? (
                                  <img
                                    src='/images/sbp-logo.svg'
                                    alt='СБП'
                                    className='h-5 w-5 object-contain'
                                  />
                                ) : method.type === 'freekassa_card' ? (
                                  <CreditCard className='h-5 w-5 text-blue-500' />
                                ) : method.type === 'freekassa_crypto' ? (
                                  <Coins className='h-5 w-5 text-amber-500' />
                                ) : method.type === 'heleket' ? (
                                  <img
                                    src='/images/heleket-logo.svg'
                                    alt='Heleket'
                                    className='h-5 w-5 object-contain'
                                  />
                                ) : method.type === 'plategal_sbp' ? (
                                  <img
                                    src='/images/sbp-logo.svg'
                                    alt='СБП'
                                    className='h-5 w-5 object-contain'
                                  />
                                ) : method.type === 'plategal_card' ? (
                                  <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-auto' viewBox='0 0 60 40' fill='none'>
                                    <rect width='60' height='40' rx='4' fill='#1B8F4C'/>
                                    <text x='30' y='27' textAnchor='middle' fill='white' fontFamily='Arial,sans-serif' fontWeight='bold' fontSize='14'>МИР</text>
                                  </svg>
                                ) : method.type === 'plategal_intl' ? (
                                  <img
                                    src='/images/visa-mastercard.png'
                                    alt='VISA Mastercard'
                                    className='h-5 w-auto object-contain'
                                  />
                                ) : method.type === 'plategal' ? (
                                  <img
                                    src='/images/sbp-logo.svg'
                                    alt='Platega'
                                    className='h-5 w-5 object-contain'
                                  />
                                ) : method.type === 'pally' ? (
                                  <img
                                    src='/images/sbp-logo.svg'
                                    alt='Pally'
                                    className='h-5 w-5 object-contain'
                                  />
                                ) : method.type === 'freekassa_id32' ? (
                                  <img
                                    src='/visa-mastercard.png'
                                    alt='Visa/Mastercard'
                                    className='h-8 w-8 object-contain'
                                  />
                                ) : (
                                  getPaymentIcon(
                                    method.type.startsWith('waffo-') ? 'waffo' : method.type,
                                    'h-5 w-5',
                                    method.icon,
                                    method.name
                                  )
                                )}
                              </div>
                              <div className='min-w-0 flex-1'>
                                <p className='text-sm font-semibold'>{method.name}</p>
                                {subtitle && (
                                  <p className='text-muted-foreground text-xs'>{subtitle}</p>
                                )}
                              </div>
                              {isSelected && (
                                <Badge
                                  variant='outline'
                                  className='shrink-0 border-emerald-200 bg-emerald-500/10 text-[10px] text-emerald-700 dark:border-emerald-800 dark:text-emerald-400'
                                >
                                  {t('Selected')}
                                </Badge>
                              )}
                            </button>
                            {cryptoExpanded && (
                              <div className='ml-12 flex flex-col gap-1'>
                                {FREEKASSA_CRYPTO_COINS.map(coin => (
                                  <button
                                    key={coin.id}
                                    type='button'
                                    onClick={() => handleCryptoSubSelect(coin)}
                                    className={cn(
                                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all',
                                      selectedCryptoSubId === coin.id
                                        ? 'border-foreground bg-foreground/5'
                                        : 'border-border hover:border-foreground/30'
                                    )}
                                  >
                                    <span className='font-medium'>{coin.name}</span>
                                    <span className='text-muted-foreground ml-auto text-xs'>{coin.range} {coin.symbol}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── 3. SUMMARY CARD ──────────────────────────────────── */}
              <Card className='gap-0 overflow-hidden py-0 shadow-sm'>
                <CardContent className='p-0'>
                  {/* 3-column stats grid */}
                  <div className='grid grid-cols-3 divide-x border-b'>
                    {/* Bonus */}
                    <div className='px-4 py-3 text-center'>
                      <p className='text-muted-foreground mb-1 text-[10px] uppercase tracking-wide'>
                        {t('Bonus')}
                      </p>
                      <p className={cn(
                        'text-sm font-bold',
                        bonusPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''
                      )}>
                        {bonusPct > 0 ? `+${bonusPct}%` : '0%'}
                      </p>
                    </div>

                    {/* Credits */}
                    <div className='px-4 py-3 text-center'>
                      <p className='text-muted-foreground mb-1 text-[10px] uppercase tracking-wide'>
                        {t('Credits')}
                      </p>
                      <p className='flex items-center justify-center gap-1 text-sm font-bold'>
                        {totalCredits > 0 ? (
                          <>
                            <Zap className='h-3 w-3 text-amber-500' />
                            {formatQuotaShort(totalCredits)}
                          </>
                        ) : (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </p>
                    </div>

                    {/* Rate */}
                    <div className='px-4 py-3 text-center'>
                      <p className='text-muted-foreground mb-1 text-[10px] uppercase tracking-wide'>
                        {t('Rate')}
                      </p>
                      <p className='flex items-center justify-center gap-1 text-sm font-bold'>
                        {ratePerMillion != null && ratePerMillion > 0 ? (
                          <>
                            <TrendingUp className='h-3 w-3 text-blue-500' />
                            {formatCurrency(ratePerMillion)}
                          </>
                        ) : (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </p>
                    </div>
                  </div>


                  {/* Savings row */}
                  {savingsDisplayAmount != null && savingsDisplayAmount > 0 && (
                    <div className='px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 border-t'>
                      <span className='text-xs text-emerald-700 dark:text-emerald-400 font-medium'>
                        {t('Your savings')}:{' '}
                        <span className='font-bold'>
                          {displaySymbol}{savingsDisplayAmount}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Total + CTA */}
                  <div className='flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/50'>
                    <div>
                      <p className='text-muted-foreground text-xs'>{t('Will be credited')}</p>
                      {calculating ? (
                        <Skeleton className='mt-1 h-7 w-24' />
                      ) : (
                        <div className='mt-0.5 flex items-baseline gap-1'>
                          <span className='text-muted-foreground text-base font-medium'>$</span>
                          <span className='text-2xl font-bold tabular-nums leading-none'>
                            {topupAmount > 0 ? formatCurrency(topupAmount) : '—'}
                          </span>
                        </div>
                      )}
                      {isRubGateway && paymentAmount > 0 && !calculating && (
                        <p className='mt-0.5 text-xs text-muted-foreground'>
                          {t('To pay')}: <span className='font-semibold text-foreground'>₽{paymentAmount.toFixed(2)}</span>
                        </p>
                      )}
                    </div>
                    <Button
                      size='lg'
                      className='h-11 shrink-0 gap-2 rounded-xl px-6'
                      disabled={!canProceed}
                      onClick={handleProceedToPayment}
                    >
                      {paymentLoading && localSelectedMethod?.type === paymentLoading ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <ArrowRight className='h-4 w-4' />
                      )}
                      {t('Proceed to Payment')}
                    </Button>
                  </div>
                  {!localSelectedMethod && allMethodCards.length > 0 && (
                    <p className='text-muted-foreground pb-2 text-center text-[11px]'>
                      {t('Select a payment method above')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Online topup is not enabled. Please use redemption code or contact administrator.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Creem Products ───────────────────────────────────────── */}
      {enableCreemTopup &&
        Array.isArray(creemProducts) &&
        creemProducts.length > 0 &&
        onCreemProductSelect && (
          <Card className='gap-0 py-0 shadow-sm'>
            <CardContent className='p-4'>
              <Label className='text-muted-foreground mb-3 block text-xs font-medium uppercase tracking-wider'>
                {t('Creem Payment')}
              </Label>
              <CreemProductsSection
                products={creemProducts}
                onProductSelect={onCreemProductSelect}
              />
            </CardContent>
          </Card>
        )}

      {/* ── Redemption Code ──────────────────────────────────────── */}
      {redemptionEnabled ? (
        <Card className='gap-0 py-0 shadow-sm'>
          <CardContent className='p-4 space-y-3'>
            <div className='flex items-center gap-2'>
              <Gift className='text-muted-foreground h-4 w-4' />
              <Label
                htmlFor='redemption-code'
                className='text-muted-foreground text-xs font-medium uppercase tracking-wider'
              >
                {t('Have a Code?')}
              </Label>
            </div>
            <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
              <Input
                id='redemption-code'
                value={redemptionCode}
                onChange={(e) => onRedemptionCodeChange(e.target.value)}
                placeholder={t('Enter your redemption code')}
                className='h-9 min-w-0'
              />
              <Button
                onClick={onRedeem}
                disabled={redeeming}
                variant='outline'
                className='h-9 px-4'
              >
                {redeeming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {t('Redeem')}
              </Button>
            </div>
            {topupLink && (
              <p className='text-muted-foreground text-xs'>
                {t('Need a redemption code?')}{' '}
                <a
                  href={topupLink}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
                >
                  {t('Get one here')}
                  <ExternalLink className='h-3 w-3' />
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
