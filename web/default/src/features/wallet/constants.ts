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
// ============================================================================
// Wallet Constants
// ============================================================================

/**
 * Default preset amount multipliers
 * Used to generate quick select amounts based on minimum topup
 */
export const DEFAULT_PRESET_MULTIPLIERS = [1, 5, 10, 30, 50, 100, 300, 500]

/**
 * Payment method types
 */
export const PAYMENT_TYPES = {
  ALIPAY: 'alipay',
  WECHAT: 'wxpay',
  STRIPE: 'stripe',
  CREEM: 'creem',
  WAFFO: 'waffo',
  WAFFO_PANCAKE: 'waffo_pancake',
  FREEKASSA: 'freekassa',
  FREEKASSA_CARD: 'freekassa_card',
  FREEKASSA_CRYPTO: 'freekassa_crypto',
  FREEKASSA_ID32: 'freekassa_id32',
  HELEKET: 'heleket',
  PALLY: 'pally',
  PLATEGAL: 'plategal',
  PLATEGAL_SBP: 'plategal_sbp',
  PLATEGAL_CARD: 'plategal_card',
  PLATEGAL_INTL: 'plategal_intl',
} as const

/**
 * Default payment type
 */
export const DEFAULT_PAYMENT_TYPE = PAYMENT_TYPES.ALIPAY

/**
 * Payment icon colors (HEX format for react-icons)
 */
export const PAYMENT_ICON_COLORS = {
  [PAYMENT_TYPES.ALIPAY]: '#1677FF',
  [PAYMENT_TYPES.WECHAT]: '#07C160',
  [PAYMENT_TYPES.STRIPE]: '#635BFF',
  [PAYMENT_TYPES.CREEM]: '#6366F1',
  [PAYMENT_TYPES.WAFFO]: '#2563EB',
  [PAYMENT_TYPES.WAFFO_PANCAKE]: '#F97316',
  [PAYMENT_TYPES.FREEKASSA]: '#10B981',
  [PAYMENT_TYPES.FREEKASSA_CARD]: '#3B82F6',
  [PAYMENT_TYPES.FREEKASSA_CRYPTO]: '#F59E0B',
  [PAYMENT_TYPES.FREEKASSA_ID32]: '#8B5CF6',
  [PAYMENT_TYPES.HELEKET]: '#F7931A',
  [PAYMENT_TYPES.PALLY]: '#6366F1',
  [PAYMENT_TYPES.PLATEGAL]: '#7C3AED',
  [PAYMENT_TYPES.PLATEGAL_SBP]: '#4F46E5',
  [PAYMENT_TYPES.PLATEGAL_CARD]: '#7C3AED',
  [PAYMENT_TYPES.PLATEGAL_INTL]: '#0EA5E9',
} as const

/**
 * Quota conversion rate: 500,000 units = $1
 */
export const QUOTA_PER_DOLLAR = 500000

/**
 * Default discount rate (no discount)
 */
export const DEFAULT_DISCOUNT_RATE = 1.0

/**
 * Default minimum topup amount
 */
export const DEFAULT_MIN_TOPUP = 1
