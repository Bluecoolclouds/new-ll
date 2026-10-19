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
import { api } from '@/lib/api'
import type {
  RedemptionRequest,
  PaymentRequest,
  AmountRequest,
  AffiliateTransferRequest,
  ApiResponse,
  TopupInfoResponse,
  RedemptionResponse,
  AmountResponse,
  PaymentResponse,
  StripePaymentResponse,
  AffiliateCodeResponse,
  AffiliateTransferResponse,
  BillingHistoryResponse,
  CompleteOrderRequest,
  CreemPaymentRequest,
  CreemPaymentResponse,
  WaffoPaymentRequest,
  WaffoPaymentResponse,
  WaffoPancakePaymentRequest,
  WaffoPancakePaymentResponse,
  FreeKassaPaymentRequest,
  FreeKassaPaymentResponse,
  HeleketPaymentRequest,
  HeleketPaymentResponse,
  PallyPaymentRequest,
  PallyPaymentResponse,
  PlategalPaymentRequest,
  PlategalPaymentResponse,
} from './types'

// ============================================================================
// Wallet API Functions
// ============================================================================

/**
 * Check if API response is successful
 */
export function isApiSuccess(response: ApiResponse): boolean {
  return response.success === true || response.message === 'success'
}

/**
 * Get topup configuration info
 */
export async function getTopupInfo(): Promise<TopupInfoResponse> {
  const res = await api.get('/api/user/topup/info')
  return res.data
}

/**
 * Redeem a topup code
 */
export async function redeemTopupCode(
  request: RedemptionRequest
): Promise<RedemptionResponse> {
  const res = await api.post('/api/user/topup', request)
  return res.data
}

/**
 * Calculate payment amount for regular payment
 */
export async function calculateAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Stripe payment
 */
export async function calculateStripeAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/stripe/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request regular payment
 */
export async function requestPayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  const res = await api.post('/api/user/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return {
    ...res.data,
    url: res.data.url || (res as unknown as { url?: string }).url,
  }
}

/**
 * Request Stripe payment
 */
export async function requestStripePayment(
  request: PaymentRequest
): Promise<StripePaymentResponse> {
  const res = await api.post('/api/user/stripe/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Creem payment
 */
export async function requestCreemPayment(
  request: CreemPaymentRequest
): Promise<CreemPaymentResponse> {
  const res = await api.post('/api/user/creem/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Waffo payment
 */
export async function requestWaffoPayment(
  request: WaffoPaymentRequest
): Promise<WaffoPaymentResponse> {
  const res = await api.post('/api/user/waffo/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Waffo Pancake payment
 */
export async function calculateWaffoPancakeAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/waffo-pancake/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Waffo Pancake payment
 */
export async function requestWaffoPancakePayment(
  request: WaffoPancakePaymentRequest
): Promise<WaffoPancakePaymentResponse> {
  const res = await api.post('/api/user/waffo-pancake/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for FreeKassa payment
 */
export async function calculateFreeKassaAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/freekassa/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request FreeKassa payment
 */
export async function requestFreeKassaPayment(
  request: FreeKassaPaymentRequest
): Promise<FreeKassaPaymentResponse> {
  const res = await api.post('/api/user/freekassa/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Heleket payment
 */
export async function calculateHeleketAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/heleket/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Heleket crypto payment
 */
export async function requestHeleketPayment(
  request: HeleketPaymentRequest
): Promise<HeleketPaymentResponse> {
  const res = await api.post('/api/user/heleket/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Pally payment
 */
export async function calculatePallyAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/pally/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Platega payment
 */
export async function calculatePlategalAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/plategal/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Platega payment
 */
export async function requestPlategalPayment(
  request: PlategalPaymentRequest
): Promise<PlategalPaymentResponse> {
  const res = await api.post('/api/user/plategal/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Pally payment
 */
export async function requestPallyPayment(
  request: PallyPaymentRequest
): Promise<PallyPaymentResponse> {
  const res = await api.post('/api/user/pally/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get affiliate code
 */
export async function getAffiliateCode(): Promise<AffiliateCodeResponse> {
  const res = await api.get('/api/user/aff')
  return res.data
}

/**
 * Transfer affiliate quota to balance
 */
export async function transferAffiliateQuota(
  request: AffiliateTransferRequest
): Promise<AffiliateTransferResponse> {
  const res = await api.post('/api/user/aff_transfer', request)
  return res.data
}

/**
 * Get billing history for current user
 */
export async function getUserBillingHistory(
  page: number,
  pageSize: number,
  keyword?: string
): Promise<ApiResponse<BillingHistoryResponse>> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) {
    params.append('keyword', keyword)
  }
  const res = await api.get(`/api/user/topup/self?${params.toString()}`)
  return res.data
}

/**
 * Get billing history for all users (admin only)
 */
export async function getAllBillingHistory(
  page: number,
  pageSize: number,
  keyword?: string,
  paymentMethod?: string
): Promise<ApiResponse<BillingHistoryResponse>> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) {
    params.append('keyword', keyword)
  }
  if (paymentMethod) {
    params.append('payment_method', paymentMethod)
  }
  const res = await api.get(`/api/user/topup?${params.toString()}`)
  return res.data
}

/**
 * Complete a pending order (admin only)
 */
export async function completeOrder(
  request: CompleteOrderRequest
): Promise<ApiResponse> {
  const res = await api.post('/api/user/topup/complete', request)
  return res.data
}

export interface WithdrawalSubmitRequest {
  amount: number
  method: string
  details: string
}

export interface WithdrawalRecord {
  id: number
  user_id: number
  username?: string
  amount: number
  method: string
  details: string
  status: string
  note: string
  created_time: number
  updated_time: number
}

/**
 * Submit a withdrawal request
 */
export async function submitWithdrawal(
  request: WithdrawalSubmitRequest
): Promise<ApiResponse<WithdrawalRecord>> {
  const res = await api.post('/api/user/withdrawal', request)
  return res.data
}

/**
 * Get current user's withdrawal requests
 */
export async function getUserWithdrawals(): Promise<
  ApiResponse<WithdrawalRecord[]>
> {
  const res = await api.get('/api/user/withdrawal')
  return res.data
}

/**
 * Admin: get all withdrawal requests
 */
export async function adminGetWithdrawals(params: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<ApiResponse<WithdrawalRecord[]> & { total?: number }> {
  const res = await api.get('/api/user/withdrawal/admin', { params })
  return res.data
}

/**
 * Admin: approve or reject a withdrawal request
 */
export async function adminUpdateWithdrawal(
  id: number,
  status: 'approved' | 'rejected',
  note?: string
): Promise<ApiResponse<WithdrawalRecord>> {
  const res = await api.put(`/api/user/withdrawal/admin/${id}`, { status, note: note || '' })
  return res.data
}
