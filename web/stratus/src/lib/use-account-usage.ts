import { useQuery } from '@tanstack/react-query';
import { request } from './api';
import { normalizeUsageRows, type UsagePeriod, type UsageRange, type UsageRow } from './usage';
import { getAnalyticsRange, getPreviousUsageRange, type UsageSelection } from './usage-analytics';

export async function requestUsage(range: UsageRange): Promise<UsageRow[]> {
  const params = new URLSearchParams({
    start_timestamp: String(range.start),
    end_timestamp: String(range.end),
  });
  return normalizeUsageRows(await request<unknown>(`/api/data/self?${params}`));
}

export async function requestUsageComparison(range: UsageRange) {
  const previousRange = getPreviousUsageRange(range);
  // Never widen to a 60-day request. Both calls are personal, even for admins.
  const [current, previous] = await Promise.allSettled([requestUsage(range), requestUsage(previousRange)]);
  if (current.status === 'rejected') throw current.reason;
  return {
    range, rows: current.value, previousRange,
    previousRows: previous.status === 'fulfilled' ? previous.value : null,
  };
}

export function useAccountUsage(input: UsagePeriod | UsageSelection, userId: number, includePrevious = false) {
  const selection: UsageSelection = typeof input === 'string'
    ? { period: input, granularity: input === '24h' ? 'hour' : 'day' }
    : input;
  return useQuery({
    queryKey: [
      'stratus', 'usage', userId, includePrevious, selection.period, selection.granularity,
      selection.period === 'custom' ? selection.start : null,
      selection.period === 'custom' ? selection.end : null,
    ],
    enabled: Number.isSafeInteger(userId) && userId > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const range = getAnalyticsRange(selection);
      if (includePrevious) return requestUsageComparison(range);
      return { range, rows: await requestUsage(range), previousRange: null, previousRows: null };
    },
  });
}
