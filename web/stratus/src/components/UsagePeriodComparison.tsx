import { compareUsageValue, type UsageAnalytics } from '../lib/usage-analytics';
import type { UsageRange } from '../lib/usage';

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const usageRangeLabel = (range: UsageRange) =>
  `${new Date(range.start * 1000).toISOString().replace('T', ' ').replace('.000Z', '')} — ${new Date(range.end * 1000).toISOString().replace('T', ' ').replace('.000Z', '')} UTC`;
type Props = {
  currentRange?: UsageRange;
  previousRange?: UsageRange;
  current?: UsageAnalytics['summary'];
  previous?: UsageAnalytics['summary'];
  unavailable?: string;
  loading: boolean;
  onRetry: () => void;
};

export function UsagePeriodComparison({ currentRange, previousRange, current, previous, unavailable, loading, onRetry }: Props) {
  const metrics = [
    { key: 'walletTokens', label: 'Расход кошелька', unit: ' токенов кошелька' },
    { key: 'requests', label: 'Запросы', unit: '' },
    { key: 'usageTokens', label: 'Токены модели', unit: '' },
  ] as const;
  return <section className="usage-comparison" aria-labelledby="usage-comparison-title" data-testid="usage-period-comparison">
    <h3 id="usage-comparison-title">Сравнение с предыдущим периодом</h3>
    {currentRange && previousRange && <div className="usage-comparison-ranges">
      <p>Текущий: {usageRangeLabel(currentRange)}</p>
      <p>Предыдущий: {usageRangeLabel(previousRange)}</p>
      <p>Обе границы включены. Периоды равны и не пересекаются; фильтр моделей общий.</p>
    </div>}
    {loading ? <p role="status">Обновляем сравнение…</p>
      : unavailable ? <div role="status"><p>{unavailable} Изменение не рассчитано.</p><button className="workspace-action" type="button" onClick={onRetry}>Повторить</button></div>
      : current && previous ? <div className="usage-comparison-grid">
        {metrics.map(({ key, label, unit }) => {
          const value = compareUsageValue(current[key], previous[key]);
          return <div className="usage-comparison-metric" key={key} data-testid={`comparison-${key}`}>
            <h4>{label}</h4>
            {value ? <>
              <p>Сейчас: <strong>{number.format(value.current)}{unit}</strong></p>
              <p>Ранее: <strong>{number.format(value.previous)}{unit}</strong></p>
              <p className="usage-comparison-delta">
                {value.delta > 0 ? 'Рост' : value.delta < 0 ? 'Снижение' : 'Без изменений'}: {value.delta > 0 ? '+' : ''}{number.format(value.delta)}{unit}
                {value.percent !== null && ` (${value.percent > 0 ? '+' : ''}${percent.format(value.percent)} %)`}
              </p>
              {value.percent === null && <p>В предыдущем периоде — 0; процент не рассчитывается.</p>}
            </> : <p>Сравнение недоступно: не удалось преобразовать расход кошелька.</p>}
          </div>;
        })}
      </div> : <p>Сравнение пока недоступно.</p>}
    <p className="usage-comparison-note">Сравниваются сохранённые списания и использование, без пересчёта по текущим тарифам. Серверные агрегаты могут запаздывать.</p>
  </section>;
}
