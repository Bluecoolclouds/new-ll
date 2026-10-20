import { useMemo, useState, type ReactNode } from 'react';
import type { UsagePoint } from '../lib/usage';
import type { buildUsageAnalytics } from '../lib/usage-analytics';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale, type WorkspaceCopy } from '../lib/workspace-copy';
import { usageModelColor as colorFor, usageModelLabel as modelLabel } from '../lib/usage-presentation';

export type AnalyticsView = 'overview' | 'spending-bar' | 'spending-area' | 'requests-trend' | 'ranking';
type Metric = 'wallet' | 'requests';
type AnalyticsModel = ReturnType<typeof buildUsageAnalytics>['models'][number];
type Props = {
  view: AnalyticsView;
  metric: Metric;
  points: UsagePoint[];
  models: AnalyticsModel[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  walletUnavailable: boolean;
};

const modelValue = (point: UsagePoint, metric: Metric) => metric === 'wallet'
  ? point.walletTokens ?? 0
  : point.requests;
const modelTotal = (models: AnalyticsModel[], index: number, metric: Metric) =>
  models.reduce((sum, model) => sum + (model.points[index] ? modelValue(model.points[index], metric) : 0), 0);
const metricNamesForPlot = (metric: Metric, copy: WorkspaceCopy) => metric === 'wallet' ? copy.walletMetric : copy.requestsMetric;
const measureUnit = (metric: Metric, copy: WorkspaceCopy) => metric === 'wallet' ? copy.walletTokensUnit : copy.requestsUnit;
const shortTime = (seconds: number, locale: string) => new Date(seconds * 1000).toLocaleString(locale, {
  timeZone: 'UTC', ...(seconds % 86400 === 0 ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', hour: '2-digit' }),
});
const fullTime = (seconds: number, locale: string) => new Date(seconds * 1000).toLocaleString(locale, {
  timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) + ' UTC';
export function UsageAnalyticsPlot({ view, metric, points, models, selectedIndex, onSelectIndex, walletUnavailable }: Props) {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 900;
  const left = view === 'ranking' ? 215 : 76;
  const right = 876;
  const top = 28;
  const bottom = 270;
  const height = 330;
  const isSpending = view === 'spending-bar' || view === 'spending-area';
  const isTrend = view === 'requests-trend';
  const isRanking = view === 'ranking';
  const orderedModels = useMemo(() => view === 'spending-bar' && metric === 'wallet'
    ? [...models].sort((a, b) => (b.summary.walletTokens ?? -1) - (a.summary.walletTokens ?? -1) || a.model.localeCompare(b.model, locale))
    : models, [models, view, metric, locale]);
  const perModel = useMemo(() => orderedModels.map((model) => ({
    ...model,
    color: colorFor(model.model),
    values: model.points.map((point) => isSpending ? modelValue(point, metric) : point.requests),
  })), [orderedModels, isSpending, metric]);

  if (((isSpending && metric === 'wallet') || (view === 'overview' && metric === 'wallet')) && walletUnavailable) {
    return <div className="usage-state usage-unavailable"><strong>{c.chartWalletUnavailable}</strong><span>{c.chartWalletUnavailableHelp}</span></div>;
  }
  if (models.length === 0) {
    return <div className="usage-state usage-no-models" role="status"><strong>{c.noModelsSelected}</strong><span>{c.chooseModelOrAll}</span></div>;
  }
  if (isRanking) {
    const ranked = [...perModel].sort((a, b) => b.summary.requests - a.summary.requests || a.model.localeCompare(b.model, locale));
    const rankHeight = Math.max(244, 52 + ranked.length * 34);
    const max = Math.max(1, ...ranked.map((model) => model.summary.requests));
    return <div className="usage-rank-scroll" role="region" aria-label={c.requestRankingRegion} tabIndex={0}>
      <svg className="usage-rank-plot" viewBox={`0 0 ${width} ${rankHeight}`} role="img" aria-label={c.requestRankingChart}>
        {[0, 1, 2, 3].map((tick) => {
          const x = left + (right - left) * tick / 3;
          return <g key={tick}><line x1={x} x2={x} y1="12" y2={rankHeight - 18} className="usage-grid-line"/><text x={x} y={rankHeight - 2} textAnchor="middle" className="usage-y-label">{number.format(max * tick / 3)}</text></g>;
        })}
        {ranked.map((model, index) => {
          const y = 24 + index * 34;
          const value = model.summary.requests;
          return <g key={model.model}>
            <text x={left - 12} y={y + 14} textAnchor="end" className="usage-rank-label">{modelLabel(model.model)}</text>
            <rect x={left} y={y} width={(right - left) * value / max} height="20" rx="5" fill={model.color} />
            <text x={Math.min(right - 3, left + (right - left) * value / max + 8)} y={y + 14} className="usage-rank-value">{number.format(value)}</text>
          </g>;
        })}
      </svg>
      <div className="usage-screenreader-table"><table><caption>{c.requestCountCaption}</caption><thead><tr><th>{c.position}</th><th>{c.model}</th><th>{c.requestCount}</th></tr></thead><tbody>{ranked.map((model, index) => <tr key={model.model}><td>{index + 1}</td><td>{modelLabel(model.model)}</td><td>{number.format(model.summary.requests)}</td></tr>)}</tbody></table></div>
    </div>;
  }

  const values = isTrend
    ? perModel.flatMap((model) => model.values)
    : view === 'overview'
      ? points.map((point) => modelValue(point, metric))
      : points.map((_, index) => perModel.reduce((total, model) => total + model.values[index], 0));
  const max = values.reduce((ceiling, value) => Math.max(ceiling, value), 0);
  const xAt = (index: number) => view === 'spending-bar'
    ? left + (right - left) * (index + 0.5) / points.length
    : points.length <= 1 ? (left + right) / 2 : left + (right - left) * index / (points.length - 1);
  const yAt = (value: number, ceiling = max) => ceiling === 0 ? bottom : bottom - (bottom - top) * value / ceiling;
  const axisMax = max || 1;
  const hoveredModels = hoveredIndex == null || !isSpending ? [] : perModel
    .map((model) => ({ ...model, hoveredValue: model.values[hoveredIndex] ?? 0 }))
    .filter((model) => model.hoveredValue > 0)
    .sort((a, b) => b.hoveredValue - a.hoveredValue || a.model.localeCompare(b.model, locale));
  const hoveredTotal = hoveredModels.reduce((sum, model) => sum + model.hoveredValue, 0);
  const grid = [0, 1, 2, 3].map((tick) => {
    const y = top + (bottom - top) * tick / 3;
    return <g key={tick}><line x1={left} x2={right} y1={y} y2={y} className="usage-grid-line"/><text x={left - 10} y={y + 4} textAnchor="end" className="usage-y-label">{number.format(axisMax * (1 - tick / 3))}</text></g>;
  });
  const labelCount = Math.min(points.length, 10);
  const labelIndexes = labelCount === 1
    ? [0]
    : Array.from({ length: labelCount }, (_, index) => Math.round(index * (points.length - 1) / (labelCount - 1)));
  const xLabels = labelIndexes.map((index, labelIndex) =>
    <text key={points[index].timestamp} x={xAt(index)} y="312" textAnchor={labelIndexes.length === 1 ? 'middle' : labelIndex === 0 ? 'start' : labelIndex === labelIndexes.length - 1 ? 'end' : 'middle'} className="usage-x-label">{shortTime(points[index].timestamp, locale)} UTC</text>,
  );
  const overlay = points.map((point, index) => {
    const start = index === 0 ? left : (xAt(index - 1) + xAt(index)) / 2;
    const end = index === points.length - 1 ? right : (xAt(index) + xAt(index + 1)) / 2;
    const total = isSpending ? modelTotal(models, index, metric) : modelValue(point, metric);
    const label = isTrend
      ? perModel.map((model) => `${modelLabel(model.model)}: ${number.format(model.values[index] ?? 0)}`).join(' · ')
      : isSpending
        ? perModel.map((model) => `${modelLabel(model.model)}: ${number.format(model.values[index] ?? 0)} ${measureUnit(metric, c)}`).join(' · ')
        : `${metricNamesForPlot(metric, c)}: ${number.format(total)}`;
    const unit = isSpending ? ` ${measureUnit(metric, c)}` : '';
    return <rect key={point.timestamp} x={start} y={top} width={end - start} height={bottom - top} fill="transparent" tabIndex={0} role="button"
      aria-label={`${c.selectInterval} ${fullTime(point.timestamp, locale)}; ${c.total.toLocaleLowerCase(locale)} ${number.format(total)}${unit}; ${label}`}
      aria-pressed={selectedIndex === index}
      onMouseEnter={() => { onSelectIndex(index); setHoveredIndex(index); }}
      onFocus={() => { onSelectIndex(index); setHoveredIndex(index); }}
      onBlur={() => setHoveredIndex(null)}
      onClick={() => { onSelectIndex(index); setHoveredIndex(index); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectIndex(index); } }}>
      <title>{`${fullTime(point.timestamp, locale)} · ${c.total}: ${number.format(total)}${unit}${label ? ` · ${label}` : ''}`}</title>
    </rect>;
  });
  const lineSeries = isTrend ? perModel.map((model) => {
    const d = model.values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(value)}`).join(' ');
    return <g key={model.model}><path d={d} className="usage-model-line" stroke={model.color}/>{model.values.map((value, index) => model.values.length <= 80 || index === selectedIndex ? <circle key={`${model.model}-${index}`} cx={xAt(index)} cy={yAt(value)} r="2.2" fill={model.color}/> : null)}</g>;
  }) : null;

  let stackVisual: ReactNode = null;
  if (view === 'spending-bar') {
    const slot = points.length > 1 ? (right - left) / points.length : 34;
    const barWidth = Math.min(80, slot * 0.86);
    stackVisual = points.map((point, index) => {
      let accumulated = 0;
      return <g key={point.timestamp}>{perModel.map((model) => {
        const value = model.values[index] ?? 0;
        const y = yAt(accumulated + value);
        const base = yAt(accumulated);
        accumulated += value;
        return value > 0 ? <rect key={model.model} x={xAt(index) - barWidth / 2} y={y} width={barWidth} height={Math.max(0, base - y)} fill={model.color}>
          <title>{`${modelLabel(model.model)} · ${number.format(value)} ${measureUnit(metric, c)}`}</title>
        </rect> : null;
      })}</g>;
    });
  } else if (view === 'spending-area') {
    const cumulative = points.map(() => 0);
    stackVisual = perModel.map((model) => {
      const upper = model.values.map((value, index) => {
        cumulative[index] += value;
        return cumulative[index];
      });
      const lower = upper.map((value, index) => value - (model.values[index] ?? 0));
      const upperPath = upper.length === 1
        ? `M ${left} ${yAt(upper[0])} L ${right} ${yAt(upper[0])}`
        : upper.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(value)}`).join(' ');
      const lowerPath = lower.length === 1
        ? `L ${right} ${yAt(lower[0])} L ${left} ${yAt(lower[0])}`
        : lower.map((_, index) => `L ${xAt(lower.length - 1 - index)} ${yAt(lower[lower.length - 1 - index])}`).join(' ');
      return <path key={model.model} d={`${upperPath} ${lowerPath} Z`} fill={model.color} fillOpacity=".55" stroke={model.color} strokeWidth="1.2">
        <title>{`${modelLabel(model.model)} · ${number.format(model.points[selectedIndex] ? modelValue(model.points[selectedIndex], metric) : 0)} ${measureUnit(metric, c)}`}</title>
      </path>;
    });
  } else if (view === 'overview') {
    const metricValues = points.map((point) => modelValue(point, metric));
    const d = metricValues.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(value)}`).join(' ');
    const area = metricValues.length ? `${d} L ${xAt(metricValues.length - 1)} ${bottom} L ${xAt(0)} ${bottom} Z` : '';
    stackVisual = <g><path d={area} className="usage-area"/><path d={d} className="usage-line"/>{metricValues.length === 1 && <circle cx={xAt(0)} cy={yAt(metricValues[0])} r="4" fill="var(--stratus-ice-accent)"/>}</g>;
  } else stackVisual = lineSeries;

  return <div className="usage-plot-wrap" onMouseLeave={() => setHoveredIndex(null)}>
    <svg className="usage-plot" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${isTrend ? c.requestTrendChartLabel : view === 'overview' && metric === 'wallet' ? c.walletTrendChartLabel : view === 'overview' ? c.overviewChartLabel : c.modelSpendChartLabel}; ${c.utcIntervals}`}>
      {grid}{stackVisual}{overlay}
      {points[selectedIndex] && <line x1={xAt(selectedIndex)} x2={xAt(selectedIndex)} y1={top} y2={bottom} className="usage-selected-line"/>}
      {points[selectedIndex] && isSpending && <title>{`${fullTime(points[selectedIndex].timestamp, locale)} · ${c.total}: ${number.format(modelTotal(models, selectedIndex, metric))} ${measureUnit(metric, c)}`}</title>}
      {xLabels}
    </svg>
    {view === 'spending-bar' && metric === 'wallet' && hoveredIndex !== null && points[hoveredIndex] && <div className="usage-hover-breakdown" role="tooltip" aria-live="polite" data-testid="usage-hover-breakdown">
      <div className="usage-hover-breakdown-head">
        <span>{fullTime(points[hoveredIndex].timestamp, locale)}</span>
        <strong>{number.format(hoveredTotal)} {measureUnit(metric, c)}</strong>
      </div>
      {hoveredModels.length > 0
        ? <ul>{hoveredModels.map((model) => <li key={model.model}>
          <span className="usage-hover-dot" style={{ backgroundColor: model.color }} aria-hidden="true"/>
          <span className="usage-hover-model">{modelLabel(model.model)}</span>
          <strong>{number.format(model.hoveredValue)} {measureUnit(metric, c)}</strong>
        </li>)}</ul>
        : <p>{c.noSpendInInterval}</p>}
    </div>}
    <div className="usage-screenreader-table"><table>
      <caption>{metric === 'wallet' ? c.chartWalletSpendByUtc : c.chartValuesByUtc}</caption>
      <thead><tr><th>{c.interval}</th><th>{metricNamesForPlot(metric, c)}</th></tr></thead>
      <tbody>{points.map((point, index) => <tr key={point.timestamp}>
        <td>{fullTime(point.timestamp, locale)}</td>
        <td>{number.format(view === 'overview' ? modelValue(point, metric) : isSpending ? perModel.reduce((sum, model) => sum + (model.values[index] ?? 0), 0) : point.requests)}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}

