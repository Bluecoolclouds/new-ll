import { afterEach, describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UsageChart } from '../src/components/UsageChart';
import { UsagePeriodComparison, usageRangeLabel } from '../src/components/UsagePeriodComparison';
import { buildUsageAnalytics, compareUsageValue, getAnalyticsRange, getPreviousUsageRange } from '../src/lib/usage-analytics';
import { requestUsageComparison, useAccountUsage } from '../src/lib/use-account-usage';
import { quotaToWalletTokens } from '../src/lib/token-economy';

const now = Date.parse('2026-10-17T12:34:56Z');
const range = getAnalyticsRange({ period: '30d', granularity: 'day' }, now);
const previousRange = getPreviousUsageRange(range);
const row = (created_at: number, model_name = 'model-a', quota = 13, count = 2, token_used = 100) =>
  ({ created_at, model_name, quota, count, token_used });
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const summary = (count: number) => ({ quota: count, requests: count, usageTokens: count, walletTokens: count });
const renderComparison = (current = 20, previous = 10, extra = {}) => renderToStaticMarkup(
  <UsagePeriodComparison currentRange={range} previousRange={previousRange} current={summary(current)} previous={summary(previous)} loading={false} onRetry={() => {}} {...extra} />,
);

describe('equal inclusive windows', () => {
  test('all presets and granularities use separate, non-overlapping server-safe ranges', () => {
    for (const period of ['24h', '7d', '14d', '29d', '30d'] as const) {
      for (const granularity of ['hour', 'day', 'week'] as const) {
        const current = getAnalyticsRange({ period, granularity }, now);
        const previous = getPreviousUsageRange(current);
        expect(previous.end).toBe(current.start - 1);
        expect(previous.end - previous.start).toBe(current.end - current.start);
        expect(previous.end - previous.start).toBeLessThanOrEqual(2592000);
        expect(previous.bucketStart).toBeLessThanOrEqual(previous.start);
        if (granularity === 'week') expect(new Date(previous.bucketStart! * 1000).getUTCDay()).toBe(1);
      }
    }
  });

  test('custom midnight, month and leap-day crossings count each boundary once', () => {
    for (const [start, end] of [
      ['2026-10-01T00:00:00Z', '2026-10-01T01:00:00Z'],
      ['2024-03-01T00:00:00Z', '2024-03-02T00:00:00Z'],
    ]) {
      const current = getAnalyticsRange({ period: 'custom', granularity: 'week', start: Date.parse(start) / 1000, end: Date.parse(end) / 1000 }, now);
      const previous = getPreviousUsageRange(current);
      const rows = [row(previous.start - 1), row(previous.start), row(previous.end), row(current.start), row(current.end), row(current.end + 1)];
      expect(buildUsageAnalytics(rows, current, 500000).summary.requests).toBe(4);
      expect(buildUsageAnalytics(rows, previous, 500000).summary.requests).toBe(4);
    }
  });
});

test('uses historical quota, count and token_used, with identical explicit model filters', () => {
  const currentRows = [row(range.start), row(range.end, 'current-only', 99)];
  const previousRows = [row(previousRange.start, 'model-a', 26, 8, 300), row(previousRange.end, 'previous-only', 300)];
  const current = buildUsageAnalytics(currentRows, range, 500000, ['model-a']);
  const previous = buildUsageAnalytics(previousRows, previousRange, 500000, ['model-a']);
  expect(compareUsageValue(current.summary.walletTokens, previous.summary.walletTokens)?.delta).toBeCloseTo(quotaToWalletTokens(-13, 500000)!);
  expect(compareUsageValue(current.summary.requests, previous.summary.requests)).toMatchObject({ delta: -6, percent: -75 });
  expect(compareUsageValue(current.summary.usageTokens, previous.summary.usageTokens)?.delta).toBe(-200);
  expect(buildUsageAnalytics(previousRows, previousRange, 500000, []).summary.requests).toBe(0);
});

test('zero baselines and invalid conversion never produce infinite percentages', () => {
  expect(compareUsageValue(10, 0)).toEqual({ current: 10, previous: 0, delta: 10, percent: null });
  expect(compareUsageValue(0, 0)?.percent).toBe(0);
  expect(compareUsageValue(0, 10)?.percent).toBe(-100);
  expect(compareUsageValue(null, 10)).toBeNull();
  expect(compareUsageValue(Infinity, 10)).toBeNull();
  expect(renderComparison(10, 0)).toContain('процент не рассчитывается');
  expect(renderComparison(0, 0)).toContain('Без изменений');
  expect(renderComparison(0, 10)).toContain('Снижение');
});

test('renders all metrics and exact UTC seconds, but no deltas on errors, loading or disabled collection', () => {
  const html = renderComparison();
  expect(html).toContain(usageRangeLabel(range));
  expect(html).toContain(usageRangeLabel(previousRange));
  for (const key of ['walletTokens', 'requests', 'usageTokens']) expect(html).toContain(`comparison-${key}`);
  expect(html).toContain('Рост');
  for (const extra of [{ unavailable: 'Ошибка' }, { unavailable: 'Сбор статистики отключён' }, { loading: true }]) {
    const unavailableHtml = renderComparison(0, 10, extra);
    expect(unavailableHtml).not.toContain('Снижение');
    expect(unavailableHtml).not.toContain('comparison-walletTokens');
  }
  expect(html).not.toContain('Infinity');
});

test('two independent personal API requests, including admin sessions; partial failure is not an empty baseline', async () => {
  const paths: URL[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input), 'https://test.invalid');
    paths.push(url);
    const start = Number(url.searchParams.get('start_timestamp'));
    const end = Number(url.searchParams.get('end_timestamp'));
    expect(end - start).toBeLessThanOrEqual(2592000);
    return Response.json(start === range.start
      ? { success: true, data: [row(start)] }
      : { success: false, message: 'Historical statistics unavailable' });
  }) as typeof fetch;
  const data = await requestUsageComparison(range);
  expect(paths).toHaveLength(2);
  expect(paths.every((url) => url.pathname === '/api/data/self')).toBe(true);
  expect(data.rows).toHaveLength(1);
  expect(data.previousRows).toBeNull();
  expect(data.previousRange.end).toBe(range.start - 1);
  globalThis.fetch = (async () => Response.json({ success: true, data: null })) as typeof fetch;
  expect((await requestUsageComparison(range)).previousRows).toEqual([]);
  globalThis.fetch = (async () => Response.json({ success: true, data: [{ quota: 'bad' }] })) as typeof fetch;
  await expect(requestUsageComparison(range)).rejects.toThrow();
});

test('chart shows period, granularity, model selection, and Stratus-token spending', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Ask the actual hook for its key so this test exercises the chart's real cache.
  let key: readonly unknown[] = [];
  function CaptureKey() {
    useAccountUsage('7d', 123);
    key = client.getQueryCache().getAll()[0].queryKey;
    return null;
  }
  const wrapper = (content: React.ReactNode) => <QueryClientProvider client={client}>{content}</QueryClientProvider>;
  renderToStaticMarkup(wrapper(<CaptureKey />));
  const chartRange = getAnalyticsRange({ period: '7d', granularity: 'day' }, now);
  client.setQueryData(key, { range: chartRange, previousRange: null, rows: [row(chartRange.start)], previousRows: null });
  const chart = (enableDataExport: boolean, isAdmin = false) => renderToStaticMarkup(wrapper(<UsageChart userId={123} quotaPerUnit={500000} enableDataExport={enableDataExport} isAdmin={isAdmin} />));
  const html = chart(true);
  expect(html).toContain('button-period-24h');
  expect(html).toContain('button-period-7d');
  expect(html).toContain('button-period-30d');
  expect(html).toContain('select-usage-granularity');
  expect(html).toContain('class="usage-plot"');
  expect(html).toContain('Фильтр по модели');
  expect(html).toContain('button-usage-model-0');
  expect(html).not.toContain('usage-legend-only');
  expect(html).not.toContain('<input');
  expect(html).toContain('Списано токенов Stratus за 7 дней');
  expect(html).toContain('токенов Stratus');
  expect(html).not.toContain('кредитов');
  expect(html).not.toContain('input-usage-start-utc');
  expect(html).not.toContain('tab-usage-');
  expect(html).not.toContain('usage-period-comparison');
  expect(html).not.toContain('usage-interval-breakdown');
  expect(html).not.toContain('usage-details');
  expect(html).toContain('usage-model-legend');
  expect(html).not.toContain('button-toggle-usage-test-data');
  const adminHtml = chart(true, true);
  expect(adminHtml).toContain('button-toggle-usage-test-data');
  expect(adminHtml).toContain('Тестовые данные');
  expect(adminHtml).not.toContain('Тестовые данные созданы в браузере');
  const query = client.getQueryCache().getAll()[0];
  query.setState({ status: 'error', error: new Error('Refetch failed') });
  expect(chart(true)).toContain('Не удалось загрузить статистику');
  expect(chart(true)).not.toContain('class="usage-plot"');
  client.setQueryData(key, { range: chartRange, previousRange: null, rows: [], previousRows: null });
  expect(chart(false)).toContain('Статистика не собиралась');
  expect(chart(false)).not.toContain('class="usage-plot"');
  client.clear();
});
