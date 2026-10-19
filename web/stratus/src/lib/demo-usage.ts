import { walletTokensToQuota } from './token-economy';
import type { UsageRange, UsageRow } from './usage';

export const DEMO_QUOTA_PER_USD = 500_000;
const ACTIVITY_WAVE = [0.2, 0.35, 0.5, 0.28, 0.9, 1.7, 0.34, 0.25, 2.4, 0.55, 0.3, 0.8, 0.45, 0.25, 1.4, 0.37];
const DEMO_MODELS = [
  { name: 'gpt-5.4', tokensPerBucket: 24_000, offset: 0 },
  { name: 'claude-sonnet-4.5', tokensPerBucket: 16_000, offset: 5 },
  { name: 'gemini-2.5-pro', tokensPerBucket: 10_000, offset: 10 },
];

/**
 * Build deterministic in-browser sample rows for the admin chart preview.
 * These rows are never sent to the backend or persisted.
 */
export function buildDemoUsageRows(range: UsageRange, quotaPerUsd: number): UsageRow[] {
  const demoRate = Number.isFinite(quotaPerUsd) && quotaPerUsd > 0 ? quotaPerUsd : DEMO_QUOTA_PER_USD;
  const bucketStart = range.bucketStart ?? range.start;
  const rows: UsageRow[] = [];

  for (let bucket = 0; bucket < range.buckets; bucket += 1) {
    const bucketTimestamp = bucketStart + bucket * range.step;
    const createdAt = Math.min(range.end, Math.max(range.start, bucketTimestamp + Math.floor(range.step * 0.45)));
    for (const model of DEMO_MODELS) {
      const intensity = ACTIVITY_WAVE[(bucket + model.offset) % ACTIVITY_WAVE.length];
      const count = 2 + ((bucket + model.offset) % 7);
      const walletTokens = Math.round(model.tokensPerBucket * (0.55 + intensity));
      const quota = walletTokensToQuota(walletTokens, demoRate);
      if (quota === null || quota <= 0) continue;
      rows.push({
        created_at: createdAt,
        model_name: model.name,
        quota,
        count,
        token_used: count * (420 + model.offset * 11),
      });
    }
  }

  return rows;
}
