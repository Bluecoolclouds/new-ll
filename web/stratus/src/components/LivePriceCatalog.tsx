import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, AudioLines, Image as ImageIcon, Layers3, MessageCircle, Search, Video } from 'lucide-react';
import { request, requestPricing, type SystemStatus } from '../lib/api';
import { copyFor, type LandingLanguage } from '../lib/landing-copy';
import { effectiveCatalogUsd, estimateLandingTopup } from '../lib/landing-topup';
import { filterPricingModels, formatCatalogMultiplier, getCatalogPrice, getModelCapabilities, getPricingProvider, LIVE_CATALOG_PAGE_SIZE, paginatePricingModels, type ModelCapability } from '../lib/live-catalog';
import { formatTariffNumber, TOKEN_ECONOMY } from '../lib/token-economy';
import { routePath } from '../lib/routes';
import { LandingTopupCalculator } from './LandingTopupCalculator';

function formatUsdPrice(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
}

function formatModelPrice(amountUsd: number, language: LandingLanguage) {
  if (language === 'en') return formatUsdPrice(amountUsd);
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amountUsd * TOKEN_ECONOMY.usdToRub);
}

const capabilityOptions = [
  { id: 'chat', ru: 'Чат', en: 'Chat', Icon: MessageCircle },
  { id: 'images', ru: 'Изображения', en: 'Images', Icon: ImageIcon },
  { id: 'video', ru: 'Видео', en: 'Video', Icon: Video },
  { id: 'audio', ru: 'Аудио', en: 'Audio', Icon: AudioLines },
] as const;

type Props = {
  language: LandingLanguage;
  isAuthenticated: boolean;
  signupHref: string;
};

export function LivePriceCatalog({ language, isAuthenticated, signupHref }: Props) {
  const en = language === 'en';
  const copy = copyFor(language);
  const [queryText, setQueryText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [selectedCapability, setSelectedCapability] = useState<ModelCapability | 'all'>('all');
  const [page, setPage] = useState(0);
  const [amountRub, setAmountRub] = useState<number | null>(2_000);
  const query = useQuery({ queryKey: ['stratus', 'pricing'], queryFn: () => requestPricing('/api/pricing') });
  const status = useQuery({ queryKey: ['stratus', 'status'], queryFn: () => request<SystemStatus>('/api/status') });
  const allModels = query.data?.data ?? [];
  const vendors = query.data?.vendors ?? [];
  const providers = [...new Set(allModels.map((model) => getPricingProvider(model, vendors)))]
    .filter((provider) => provider !== '—')
    .sort((left, right) => left.localeCompare(right, en ? 'en' : 'ru'));
  const capabilityCounts: Record<ModelCapability, number> = { chat: 0, images: 0, video: 0, audio: 0 };
  for (const model of allModels) {
    for (const capability of getModelCapabilities(model)) capabilityCounts[capability] += 1;
  }
  const categoryCards = [
    { id: 'all' as const, ru: 'Все модели', en: 'All models', count: allModels.length, Icon: Layers3 },
    ...capabilityOptions
      .filter(({ id }) => capabilityCounts[id] > 0)
      .map((option) => ({ ...option, count: capabilityCounts[option.id] })),
  ];
  const models = filterPricingModels(
    allModels, vendors, queryText, selectedProvider, en ? 'en' : 'ru', selectedCapability,
  );
  const pageCount = Math.ceil(models.length / LIVE_CATALOG_PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleModels = paginatePricingModels(models, currentPage);
  const firstVisible = models.length ? currentPage * LIVE_CATALOG_PAGE_SIZE + 1 : 0;
  const lastVisible = Math.min(models.length, (currentPage + 1) * LIVE_CATALOG_PAGE_SIZE);
  const estimate = amountRub === null ? null : estimateLandingTopup(amountRub);
  const bonusPercent = estimate?.bonusPercent ?? 0;
  const resetPage = () => setPage(0);
  const walletHref = isAuthenticated ? routePath('/wallet') : signupHref;

  return <div className="mt-12 border-t border-[var(--land-line)] pt-10">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.12em] land-accent">{copy.catalogEyebrow}</div>
        <h3 className="display text-[35px] font-extrabold leading-none sm:text-[48px]">
          {copy.catalogTitle}
        </h3>
        <p className="mt-4 max-w-2xl text-[13px] land-muted">{copy.catalogIntro}</p>
      </div>
    </div>

    <div className="mt-7 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(270px,.78fr)_minmax(0,1.38fr)]">
      <LandingTopupCalculator
        language={language}
        copy={copy}
        amountRub={amountRub}
        estimate={estimate}
        onAmountRubChange={setAmountRub}
        actionHref={walletHref}
        actionLabel={isAuthenticated ? copy.topupAction : copy.createAccount}
      />

      <section className="catalog-frame min-w-0 rounded-[24px] border border-[#d8e7ea] bg-[#eaf4f5] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h4 className="text-[19px] font-bold tracking-[-.03em] text-[#264856]">{copy.catalogModelsTitle}</h4>
          {estimate && <span className="rounded-full bg-white/75 px-3 py-1 text-[10px] font-semibold text-[#31805d]">
            +{new Intl.NumberFormat(en ? 'en-US' : 'ru-RU', { maximumFractionDigits: 1 }).format(bonusPercent)}% {copy.topupBonus.toLowerCase()}
          </span>}
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 px-4 py-3">
          <Search size={16} className="shrink-0 text-[#6b9ead]"/>
          <input
            value={queryText}
            onChange={(event) => { setQueryText(event.target.value); resetPage(); }}
            placeholder={en ? 'Search models or providers' : 'Найти модель или провайдера'}
            aria-label={en ? 'Search models or providers' : 'Найти модель или провайдера'}
            className="w-full bg-transparent text-[13px] text-[#264856] outline-none placeholder:text-[#82959b]"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={en ? 'Model category' : 'Категория моделей'}>
          {categoryCards.map(({ id, ru, en: labelEn, count, Icon }) => {
            const selected = selectedCapability === id;
            return <button
              key={id}
              type="button"
              aria-pressed={selected}
              data-testid={`button-catalog-category-${id}`}
              onClick={() => { setSelectedCapability(id); resetPage(); }}
              className={`flex min-h-[48px] items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left transition ${selected ? 'border-[#8db9c4] bg-white shadow-sm' : 'border-white/80 bg-white/55 hover:bg-white/85'}`}
            >
              <span className="flex items-center gap-2 text-[11px] font-semibold text-[#426879]"><Icon size={14} className="shrink-0 text-[#6b9ead]"/>{en ? labelEn : ru}</span>
              <span className="rounded-full bg-[#eaf4f5] px-2 py-1 text-[10px] text-[#66818b]">{count}</span>
            </button>;
          })}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={en ? 'Provider' : 'Провайдер'}>
          {[{ id: 'all', label: en ? 'All providers' : 'Все провайдеры' }, ...providers.map((provider) => ({ id: provider, label: provider }))].map(({ id, label }) => {
            const selected = selectedProvider === id;
            return <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => { setSelectedProvider(id); resetPage(); }}
              className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-semibold transition ${selected ? 'border-[#789fac] bg-[#264856] text-white' : 'border-white/80 bg-white/65 text-[#58727c] hover:bg-white'}`}
            >
              {label}
            </button>;
          })}
        </div>

        <p className="mt-3 px-1 text-[10px] leading-relaxed text-[#66818b]">
          {copy.catalogPriceNote}
        </p>
        {query.isLoading && <div role="status" className="px-3 py-8 text-center text-[12px] text-[#66818b]">{en ? 'Loading published catalog…' : 'Загружаем опубликованный каталог…'}</div>}
        {query.isError && <div role="alert" className="px-3 py-8 text-center text-[12px] text-[#8b6468]">{en ? 'Could not load the catalog.' : 'Не удалось загрузить каталог.'} <button onClick={() => void query.refetch()} className="underline underline-offset-2">{en ? 'Retry' : 'Повторить'}</button></div>}
        {query.data && models.length === 0 && <div className="px-3 py-8 text-center text-[12px] text-[#66818b]">{query.data.data.length ? (en ? 'No matching models.' : 'Модели не найдены.') : (en ? 'No published models yet.' : 'Опубликованных моделей пока нет.')}</div>}
        {query.data && status.isLoading && <div role="status" className="px-3 py-8 text-center text-[12px] text-[#66818b]">{en ? 'Loading tariff conversion…' : 'Загружаем параметры расчёта тарифов…'}</div>}
        {query.data && status.isError && <div role="alert" className="px-3 py-8 text-center text-[12px] text-[#8b6468]">{en ? 'Could not load price conversion; prices are unavailable.' : 'Не удалось загрузить параметры расчёта. Цены недоступны.'} <button onClick={() => void status.refetch()} className="underline underline-offset-2">{en ? 'Retry' : 'Повторить'}</button></div>}
        {query.data && status.data && models.length > 0 && <>
          <div className="mt-5 overflow-auto rounded-[18px] bg-[#f1f1ee]">
            <table className="w-full min-w-[580px] border-collapse text-left">
              <thead>
                <tr className="bg-[#eaf4f5] text-[9px] uppercase tracking-[.1em] text-[#82959b]">
                  <th className="p-4">{en ? 'Model' : 'Модель'}</th>
                  <th className="p-4">{en ? 'Multiplier' : 'Коэффициент'}</th>
                  <th className="p-4">{copy.catalogPriceColumn}</th>
                </tr>
              </thead>
              <tbody>{visibleModels.map((model) => {
                const price = getCatalogPrice(model, query.data, status.data.quota_per_unit ?? NaN);
                const multiplier = price.kind === 'tokens'
                  ? formatCatalogMultiplier(price.multiplier)
                  : price.kind === 'request'
                    ? `${formatTariffNumber(price.walletTokens)} ${en ? 'wallet tokens / request' : 'токенов / вызов'}`
                    : (en ? 'Not calculated' : 'Не рассчитан');
                const adjustedUsd = !estimate || price.kind === 'unavailable'
                  ? null
                  : effectiveCatalogUsd(price.usd, bonusPercent);
                const amount = adjustedUsd === null
                  ? '—'
                  : price.kind === 'tokens'
                    ? `${en ? 'From' : 'От'} ${formatModelPrice(adjustedUsd, language)} ${en ? '/ 1M model tokens' : '/ 1 млн токенов модели'}`
                    : `${en ? 'From' : 'От'} ${formatModelPrice(adjustedUsd, language)} ${en ? '/ request' : '/ вызов'}`;
                return <tr key={model.model_name} className="border-t border-[#e0e7e7] text-[11px] text-[#516d77]">
                  <td className="p-4">
                    <strong className="block text-[13px] text-[#264856]">{model.model_name}</strong>
                    <span>{getPricingProvider(model, vendors)}</span>
                  </td>
                  <td className="p-4 font-semibold">{multiplier}</td>
                  <td className="p-4 font-semibold">{amount}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#66818b]">
            <p aria-live="polite">
              {en ? `Showing ${firstVisible}–${lastVisible} of ${models.length} models` : `Показано ${firstVisible}–${lastVisible} из ${models.length} моделей`}
            </p>
            {pageCount > 1 && <nav className="flex items-center gap-2" aria-label={en ? 'Catalog pages' : 'Страницы каталога'}>
              <button
                type="button"
                aria-label={en ? 'Previous page' : 'Предыдущая страница'}
                disabled={currentPage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/90 bg-white/80 disabled:opacity-40"
              ><ArrowLeft size={14}/></button>
              <span>{en ? `Page ${currentPage + 1} of ${pageCount}` : `Страница ${currentPage + 1} из ${pageCount}`}</span>
              <button
                type="button"
                aria-label={en ? 'Next page' : 'Следующая страница'}
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/90 bg-white/80 disabled:opacity-40"
              ><ArrowRight size={14}/></button>
            </nav>}
          </div>
        </>}
      </section>
    </div>
  </div>;
}
