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
import {
  PAYMENT_TYPES,
  DEFAULT_PRESET_MULTIPLIERS,
  DEFAULT_PAYMENT_TYPE,
  DEFAULT_MIN_TOPUP,
} from '../constants'
import type { PresetAmount, TopupInfo } from '../types'

// ============================================================================
// Payment Processing Functions
// ============================================================================

/**
 * Check if browser is Safari
 */
function isSafariBrowser(): boolean {
  return (
    navigator.userAgent.indexOf('Safari') > -1 &&
    navigator.userAgent.indexOf('Chrome') < 1
  )
}

/**
 * Submit payment form (for non-Stripe payments)
 */
export function submitPaymentForm(
  url: string,
  params: Record<string, unknown>
): void {
  const form = document.createElement('form')
  form.action = url
  form.method = 'POST'

  // Don't open in new tab for Safari
  if (!isSafariBrowser()) {
    form.target = '_blank'
  }

  // Add form parameters
  Object.entries(params).forEach(([key, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}

/**
 * Check if payment method is Stripe
 */
export function isStripePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.STRIPE
}

/**
 * Check if payment method is Waffo Pancake
 *
 * Pancake is a metered-style payment that goes through a dedicated checkout
 * URL flow rather than the generic epay form submission, so it must be
 * special-cased in payment dispatch logic.
 */
export function isWaffoPancakePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WAFFO_PANCAKE
}

/**
 * Check if payment method is FreeKassa (any variant: SBP, card, crypto)
 */
export function isFreeKassaPayment(paymentType: string): boolean {
  return (
    paymentType === PAYMENT_TYPES.FREEKASSA ||
    paymentType === PAYMENT_TYPES.FREEKASSA_CARD ||
    paymentType === PAYMENT_TYPES.FREEKASSA_CRYPTO ||
    paymentType === PAYMENT_TYPES.FREEKASSA_ID32 ||
    paymentType.startsWith('freekassa_crypto_')
  )
}

/**
 * Check if payment method is Heleket (crypto gateway)
 */
export function isHeleketPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.HELEKET
}

/**
 * Check if payment method is Pally (RUB gateway)
 */
export function isPallyPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.PALLY
}

export function isPlategalPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.PLATEGAL
}

export function isPlategalSubPayment(paymentType: string): boolean {
  return (
    paymentType === PAYMENT_TYPES.PLATEGAL_SBP ||
    paymentType === PAYMENT_TYPES.PLATEGAL_CARD ||
    paymentType === PAYMENT_TYPES.PLATEGAL_INTL
  )
}

/**
 * Get default payment type from topup info
 */
export function getDefaultPaymentType(topupInfo: TopupInfo | null): string {
  if (!topupInfo) {
    return DEFAULT_PAYMENT_TYPE
  }

  // Return first available payment method or default
  if (topupInfo.pay_methods?.length > 0) {
    return topupInfo.pay_methods[0].type
  }

  if (topupInfo.enable_stripe_topup) {
    return PAYMENT_TYPES.STRIPE
  }

  if (topupInfo.enable_waffo_topup) {
    return PAYMENT_TYPES.WAFFO
  }

  if (topupInfo.enable_waffo_pancake_topup) {
    return PAYMENT_TYPES.WAFFO_PANCAKE
  }

  if (topupInfo.enable_freekassa_topup) {
    return PAYMENT_TYPES.FREEKASSA
  }

  return DEFAULT_PAYMENT_TYPE
}

/**
 * Get minimum topup amount from topup info
 */
export function getMinTopupAmount(topupInfo: TopupInfo | null): number {
  if (!topupInfo) {
    return DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_online_topup) {
    return topupInfo.min_topup
  }

  if (topupInfo.enable_stripe_topup) {
    return topupInfo.stripe_min_topup
  }

  if (topupInfo.enable_waffo_topup) {
    return topupInfo.waffo_min_topup || DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_waffo_pancake_topup) {
    return topupInfo.waffo_pancake_min_topup || DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_freekassa_topup) {
    return topupInfo.freekassa_min_topup || DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_heleket_topup) {
    return topupInfo.heleket_min_topup || DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_pally_topup) {
    const pallyUnitPrice = topupInfo.pally_unit_price || 0.0002
    const rubPerUsd = pallyUnitPrice * 500000
    if (rubPerUsd > 0 && topupInfo.pally_min_topup) {
      return Math.max(1, Math.ceil(topupInfo.pally_min_topup / rubPerUsd))
    }
    return DEFAULT_MIN_TOPUP
  }

  if (
    topupInfo.enable_plategal_topup ||
    topupInfo.pay_methods?.some((m) =>
      ['plategal_sbp', 'plategal_card', 'plategal_intl'].includes(m.type)
    )
  ) {
    const plategalUnitPrice = topupInfo.plategal_unit_price || 0.0002
    const rubPerUsd = plategalUnitPrice * 500000
    if (rubPerUsd > 0 && topupInfo.plategal_min_topup) {
      return Math.max(1, Math.ceil(topupInfo.plategal_min_topup / rubPerUsd))
    }
    return DEFAULT_MIN_TOPUP
  }

  return DEFAULT_MIN_TOPUP
}

/**
 * Generate preset amounts based on minimum topup
 */
export function generatePresetAmounts(
  minAmount: number,
  discounts: Record<number, number> = {}
): PresetAmount[] {
  return DEFAULT_PRESET_MULTIPLIERS.map((multiplier) => {
    const value = minAmount * multiplier
    return {
      value,
      discount: getAmountDiscount(value, discounts),
    }
  })
}

/**
 * Threshold-based discount lookup: returns the discount for the highest
 * configured threshold that is <= amount. Returns 1.0 when no match.
 */
export function getAmountDiscount(
  amount: number,
  discounts: Record<number, number>
): number {
  let bestThreshold = -1
  let discount = 1.0
  for (const [key, value] of Object.entries(discounts)) {
    const threshold = Number(key)
    if (threshold <= amount && threshold > bestThreshold && value > 0) {
      bestThreshold = threshold
      discount = value
    }
  }
  return discount
}

/**
 * Merge custom preset amounts with discounts
 */
export function mergePresetAmounts(
  amountOptions: number[],
  discounts: Record<number, number>
): PresetAmount[] {
  if (!amountOptions || amountOptions.length === 0) {
    return []
  }

  return amountOptions.map((amount) => ({
    value: amount,
    discount: getAmountDiscount(amount, discounts),
  }))
}
