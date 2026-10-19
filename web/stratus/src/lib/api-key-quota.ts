export function getApiKeyQuotaUsage(usedQuota: number, remainingQuota: number) {
  const used = Number.isFinite(usedQuota) ? Math.max(0, usedQuota) : 0;
  const remaining = Number.isFinite(remainingQuota) ? Math.max(0, remainingQuota) : 0;
  const total = used + remaining;
  const percentage = total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0;
  return { used, remaining, total, percentage };
}
