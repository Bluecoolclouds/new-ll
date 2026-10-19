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
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { getCurrencyDisplay } from '@/lib/currency'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import { DEFAULT_GROUP } from '../constants'
import { type ApiKeyFormData, type ApiKey } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export function getApiKeyFormSchema(t: TFunction) {
  return z
    .object({
      name: z.string().min(1, t('Please enter a name')),
      remain_quota_dollars: z.number().optional(),
      expired_time: z.date().optional(),
      unlimited_quota: z.boolean(),
      model_limits: z.array(z.string()),
      allow_ips: z.string().optional(),
      group: z.string().optional(),
      cross_group_retry: z.boolean().optional(),
      gateway_enabled: z.boolean(),
      gateway_profile: z.enum(['cost', 'ordered', 'speed', 'reliable']),
      gateway_daily_limit: z.number().min(0),
      gateway_monthly_limit: z.number().min(0),
      gateway_warning_percent: z.number().int().min(1).max(100),
      gateway_concurrency_limit: z.number().int().min(0),
      tokenCount: z.number().min(1).optional(),
    })
    .superRefine((data, ctx) => {
      if (
        !data.unlimited_quota &&
        (data.remain_quota_dollars === undefined ||
          data.remain_quota_dollars < 0)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['remain_quota_dollars'],
          message: t('Quota must be zero or greater'),
        })
      }
      if (data.gateway_enabled && data.model_limits.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['model_limits'],
          message: t('Select at least one model for Gateway mode'),
        })
      }
    })
}

export type ApiKeyFormValues = z.infer<ReturnType<typeof getApiKeyFormSchema>>

// ============================================================================
// Form Defaults
// ============================================================================

export const API_KEY_FORM_DEFAULT_VALUES: ApiKeyFormValues = {
  name: '',
  remain_quota_dollars: 10,
  expired_time: undefined,
  unlimited_quota: true,
  model_limits: [],
  allow_ips: '',
  group: DEFAULT_GROUP,
  cross_group_retry: true,
  gateway_enabled: false,
  gateway_profile: 'ordered',
  gateway_daily_limit: 0,
  gateway_monthly_limit: 0,
  gateway_warning_percent: 80,
  gateway_concurrency_limit: 0,
  tokenCount: 1,
}

export function getApiKeyFormDefaultValues(
  defaultUseAutoGroup: boolean
): ApiKeyFormValues {
  return {
    ...API_KEY_FORM_DEFAULT_VALUES,
    group: defaultUseAutoGroup ? 'auto' : DEFAULT_GROUP,
    cross_group_retry: defaultUseAutoGroup,
  }
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: ApiKeyFormValues
): ApiKeyFormData {
  const { config } = getCurrencyDisplay()
  return {
    name: data.name,
    remain_quota: data.unlimited_quota
      ? 0
      : parseQuotaFromDollars(data.remain_quota_dollars || 0),
    expired_time: data.expired_time
      ? Math.floor(data.expired_time.getTime() / 1000)
      : -1,
    unlimited_quota: data.unlimited_quota,
    model_limits_enabled: data.model_limits.length > 0,
    model_limits: data.model_limits.join(','),
    allow_ips: data.allow_ips || '',
    group: data.group || '',
    cross_group_retry: data.group === 'auto' ? !!data.cross_group_retry : false,
    gateway_enabled: data.gateway_enabled,
    gateway_profile: data.gateway_profile,
    gateway_daily_limit: Math.round(data.gateway_daily_limit * config.quotaPerUnit),
    gateway_monthly_limit: Math.round(data.gateway_monthly_limit * config.quotaPerUnit),
    gateway_warning_percent: data.gateway_warning_percent,
    gateway_concurrency_limit: data.gateway_concurrency_limit,
  }
}

/**
 * Transform API key data to form defaults
 */
export function transformApiKeyToFormDefaults(
  apiKey: ApiKey
): ApiKeyFormValues {
  const { config } = getCurrencyDisplay()
  return {
    name: apiKey.name,
    remain_quota_dollars: apiKey.unlimited_quota
      ? 0
      : quotaUnitsToDollars(apiKey.remain_quota),
    expired_time:
      apiKey.expired_time > 0
        ? new Date(apiKey.expired_time * 1000)
        : undefined,
    unlimited_quota: apiKey.unlimited_quota,
    model_limits: apiKey.model_limits
      ? apiKey.model_limits.split(',').filter(Boolean)
      : [],
    allow_ips: apiKey.allow_ips || '',
    group: apiKey.group || DEFAULT_GROUP,
    cross_group_retry: !!apiKey.cross_group_retry,
    gateway_enabled: apiKey.gateway_enabled === true,
    gateway_profile: ['cost', 'speed', 'reliable'].includes(apiKey.gateway_profile)
      ? apiKey.gateway_profile
      : 'ordered',
    gateway_daily_limit: (apiKey.gateway_daily_limit ?? 0) / config.quotaPerUnit,
    gateway_monthly_limit: (apiKey.gateway_monthly_limit ?? 0) / config.quotaPerUnit,
    gateway_warning_percent: apiKey.gateway_warning_percent ?? 80,
    gateway_concurrency_limit: apiKey.gateway_concurrency_limit ?? 0,
    tokenCount: 1,
  }
}
