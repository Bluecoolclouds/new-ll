import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { UsageAnalyticsPlot, type AnalyticsView } from '../src/components/UsageAnalyticsPlot';
import { UsageModelLegend } from '../src/components/UsageModelLegend';
import { buildUsageAnalytics, getAnalyticsRange } from '../src/lib/usage-analytics';
import { DEFAULT_USAGE_CHART_VIEW, usageModelColor } from '../src/lib/usage-presentation';

const now = Date.parse('2026-10-17T12:34:56Z');
const range = getAnalyticsRange({
  period: 'custom', granularity: 'week',
  start: Date.parse('2026-10-14T00:00:00Z') / 1000,
  end: Date.parse('2026-10-16T00:00:00Z') / 1000,
}, now);
const data = buildUsageAnalytics([
  { model_name: 'model-a', created_at: range.start, quota: 400, count: 2, token_used: 40 },
  { model_name: 'model-b', created_at: range.start, quota: 100, count: 5, token_used: 60 },
], range, 500000);
const plot = (view: AnalyticsView, value = data, metric: 'wallet' | 'requests' = 'wallet') => renderToStaticMarkup(
  <UsageAnalyticsPlot view={view} metric={metric} points={value.points} models={value.models}
    selectedIndex={0} onSelectIndex={() => {}} walletUnavailable={false} />,
);

describe('model chart rendering edge cases', () => {
  test('distribution columns are the dashboard default, with stacked bar and area presentations available', () => {
    expect(DEFAULT_USAGE_CHART_VIEW).toBe('spending-bar');
    for (const view of ['spending-bar', 'spending-area'] as const) {
      expect(plot(view)).toContain('Расход токенов Stratus по моделям');
      expect(plot(view)).toContain('токенов Stratus');
    }
    expect(plot('spending-bar')).toContain('<rect');
    expect(plot('spending-area')).toContain('fill-opacity=".55"');
  });

  test('spending bars expose each model and historical Stratus-wallet-token costs', () => {
    const html = plot('spending-bar');
    expect(html).toContain('model-a · 6');
    expect(html).toContain('model-b · 1');
    expect(html).toContain('токенов Stratus');
    expect(html).not.toContain('кредитов');
  });

  test('stacked spending bars put the highest-spend model at the bottom', () => {
    const highSpendFirst = buildUsageAnalytics([
      { model_name: 'low-spend', created_at: range.start, quota: 100, count: 1, token_used: 10 },
      { model_name: 'high-spend', created_at: range.start, quota: 400, count: 1, token_used: 10 },
    ], range, 500000);
    const html = plot('spending-bar', highSpendFirst);
    const segmentOrder = [...html.matchAll(/<title>(high-spend|low-spend) · [^<]+<\/title>/g)]
      .map((match) => match[1]);
    expect(segmentOrder.slice(0, 2)).toEqual(['high-spend', 'low-spend']);
  });

  test('every requested chart mode renders, with no pie or donut mode', () => {
    for (const view of ['overview', 'spending-bar', 'spending-area', 'requests-trend', 'ranking'] as const) {
      const html = plot(view);
      expect(html).toContain('<svg');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
    }
  });

  test('one weekly interval produces visible non-degenerate stacked areas', () => {
    expect(data.points).toHaveLength(1);
    const html = plot('spending-area');
    expect((html.match(/class="usage-x-label"/g) ?? []).length).toBe(1);
    expect(html).toContain('<div class="usage-screenreader-table"><table>');
    const paths = [...html.matchAll(/<path d="([^"]+)"[^>]*fill-opacity="0?\.55"/g)];
    expect(paths).toHaveLength(2);
    for (const match of paths) {
      const coordinates = [...match[1].matchAll(/[ML] ([\d.]+) ([\d.]+)/g)];
      expect(new Set(coordinates.map((point) => point[1])).size).toBeGreaterThan(1);
      expect(new Set(coordinates.map((point) => point[2])).size).toBeGreaterThan(1);
    }
    expect(plot('overview')).toContain('<circle');
  });

  test('hover targets cover the whole plot rather than thin gaps between points', () => {
    const html = plot('spending-bar');
    expect(html).toContain('width="800" height="242" fill="transparent"');
  });

  test('dense hourly bars remain narrower than their time slots', () => {
    const dense = getAnalyticsRange({ period: '30d', granularity: 'hour' }, now);
    const value = buildUsageAnalytics(Array.from({ length: dense.buckets }, (_, index) => ({
      model_name: 'dense-model', created_at: Math.max(dense.start, dense.bucketStart! + index * dense.step),
      quota: 10, count: 1, token_used: 3,
    })), dense, 500000);
    const bars = [...plot('spending-bar', value).matchAll(/<rect[^>]*width="([\d.]+)"[^>]*fill="hsl\(/g)];
    expect(bars).toHaveLength(dense.buckets);
    expect(bars.every((bar) => Number(bar[1]) < 800 / dense.buckets)).toBe(true);
  });

  test('a large model-by-hour matrix does not exceed argument limits or create a circle for every zero', () => {
    const dense = getAnalyticsRange({ period: '30d', granularity: 'hour' }, now);
    const value = buildUsageAnalytics(Array.from({ length: 180 }, (_, index) => ({
      model_name: `model-${index}`, created_at: dense.end, quota: 10, count: index + 1, token_used: 3,
    })), dense, 500000);
    const html = plot('requests-trend', value);
    expect((html.match(/<circle/g) ?? []).length).toBe(180);
    expect(html).not.toContain('NaN');
  });

  test('ranking includes all models and follows request count, not wallet spend', () => {
    const html = plot('ranking');
    const rows = html.slice(html.indexOf('<tbody'));
    expect(rows.indexOf('model-b')).toBeLessThan(rows.indexOf('model-a'));
    expect(html).toContain('Число запросов по моделям');
  });

  test('model colors are stable, categorical, and distinct across a broad set of models', () => {
    expect(usageModelColor('model-a')).toBe(usageModelColor('model-a'));
    expect(usageModelColor('model-a')).not.toBe(usageModelColor('model-b'));
    const colors = Array.from({ length: 16 }, (_, index) => usageModelColor(`distinct-model-${index}`));
    expect(new Set(colors).size).toBeGreaterThanOrEqual(10);
    expect(colors.every((color) => /^hsl\(\d+ 65% (?:7\d|80)%\)$/.test(color))).toBe(true);
  });

  test('model selector shows only model-name blocks while chart totals keep every model', () => {
    const many = buildUsageAnalytics(Array.from({ length: 23 }, (_, index) => ({
      model_name: `model-${index}`, created_at: range.start, quota: 100, count: 1, token_used: 10,
    })), range, 500000);
    const legend = renderToStaticMarkup(<UsageModelLegend models={many.models.map((item) => item.model)}
      selectedModel={null} onSelect={() => {}} />);
    const graph = renderToStaticMarkup(<UsageAnalyticsPlot view="spending-bar" metric="wallet"
      points={many.points} models={many.models} selectedIndex={0} onSelectIndex={() => {}} walletUnavailable={false} />);
    expect((legend.match(/class="usage-model-chip/g) ?? []).length).toBe(23);
    expect(legend).not.toContain('<input');
    expect(legend).not.toContain('Только');
    expect(legend).not.toContain('Показать все');
    expect(many.summary.requests).toBe(23);
    expect(graph.match(/<rect[^>]*fill="hsl\(/g)?.length).toBe(23);
    expect(graph).toContain('Всего:');
    expect(graph).toContain('токенов Stratus');
    expect(graph).not.toContain('кредитов');
  });
});
