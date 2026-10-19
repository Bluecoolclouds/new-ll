import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgePercent } from 'lucide-react';
import type { LandingLanguage, LandingCopyKey } from '../lib/landing-copy';
import { WALLET_BONUS_FULL_RUB, WALLET_BONUS_START_RUB } from '../lib/wallet-bonus';
import { formatUsdAmount, rublesToUsd, rublesToUsdInput, usdToRubles } from '../lib/wallet-currency';
import type { LandingTopupEstimate } from '../lib/landing-topup';

type Props = {
  language: LandingLanguage;
  copy: Record<LandingCopyKey, string>;
  amountRub: number | null;
  estimate: LandingTopupEstimate | null;
  onAmountRubChange: (amountRub: number | null) => void;
  actionHref: string;
  actionLabel: string;
};

const PRESET_AMOUNTS_RUB = [500, 2_000, 10_000, 25_000];

function amountInputValue(amountRub: number | null, language: LandingLanguage) {
  if (amountRub === null) return '';
  return language === 'en' ? rublesToUsdInput(amountRub) : String(amountRub);
}

function amountLabel(amountRub: number, language: LandingLanguage) {
  if (language === 'en') {
    return formatUsdAmount(rublesToUsd(amountRub) ?? 0, 'en-US');
  }
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amountRub)} ₽`;
}

function rateLabel(amountRub: number, language: LandingLanguage) {
  if (language === 'en') {
    return formatUsdAmount((rublesToUsd(amountRub) ?? 0), 'en-US');
  }
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountRub);
}

function parseInputAmount(value: string, language: LandingLanguage): number | null {
  if (!value.trim()) return null;
  const numeric = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const rubles = language === 'en' ? usdToRubles(numeric) : Math.round(numeric);
  return rubles !== null && Number.isSafeInteger(rubles) && rubles > 0 ? rubles : null;
}

function percentage(value: number, language: LandingLanguage) {
  return `${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function tokenBalanceLabel(tokens: number, language: LandingLanguage) {
  const millions = new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', {
    maximumFractionDigits: 2,
  }).format(tokens / 1_000_000);
  return language === 'en' ? `${millions}M tokens` : `${millions} млн токенов`;
}

export function LandingTopupCalculator({
  language,
  copy,
  amountRub,
  estimate,
  onAmountRubChange,
  actionHref,
  actionLabel,
}: Props) {
  const en = language === 'en';
  const [amountInput, setAmountInput] = useState(() => amountInputValue(amountRub, language));
  const previousLanguage = useRef(language);
  const start = en ? Number(rublesToUsdInput(WALLET_BONUS_START_RUB)) : WALLET_BONUS_START_RUB;
  const end = en ? Number(rublesToUsdInput(WALLET_BONUS_FULL_RUB)) : WALLET_BONUS_FULL_RUB;
  const sliderRub = Math.min(WALLET_BONUS_FULL_RUB, Math.max(WALLET_BONUS_START_RUB, amountRub ?? WALLET_BONUS_START_RUB));
  const sliderValue = en ? Number(rublesToUsdInput(sliderRub)) : sliderRub;
  const currencyUnit = en ? 'USD' : '₽';

  useEffect(() => {
    if (previousLanguage.current !== language) {
      setAmountInput(amountInputValue(amountRub, language));
      previousLanguage.current = language;
    }
  }, [amountRub, language]);

  const updateAmountFromSlider = (value: string) => {
    const rubles = en ? usdToRubles(Number(value)) : Math.round(Number(value));
    if (rubles === null || !Number.isSafeInteger(rubles)) return;
    onAmountRubChange(rubles);
    setAmountInput(amountInputValue(rubles, language));
  };

  return <section className="landing-topup-calculator land-panel min-w-0 max-w-full rounded-[24px] border land-line p-5 sm:p-6">
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] land-accent">
      <BadgePercent size={15}/>
      <span>{copy.topupAmount}</span>
    </div>
    <label className="mt-5 flex min-h-[68px] items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm focus-within:border-[#8db9c4]">
      <input
        type="number"
        min="0.01"
        step={en ? '0.01' : '1'}
        inputMode="decimal"
        value={amountInput}
        onChange={(event) => {
          setAmountInput(event.target.value);
          onAmountRubChange(parseInputAmount(event.target.value, language));
        }}
        aria-label={copy.topupAmount}
        data-testid="landing-topup-amount"
        className="min-w-0 flex-1 bg-transparent text-[28px] font-extrabold tracking-[-.05em] text-[#243f4c] outline-none sm:text-[34px]"
      />
      <span className="text-[13px] font-semibold text-[#70848b]">{currencyUnit}</span>
    </label>

    <input
      type="range"
      min={start}
      max={end}
      step={en ? '0.01' : '100'}
      value={sliderValue}
      onChange={(event) => updateAmountFromSlider(event.target.value)}
      aria-label={copy.topupAmount}
      data-testid="landing-topup-slider"
      className="mt-5 h-2 w-full cursor-pointer accent-[#6daebe]"
    />
    <div className="mt-1 flex justify-between text-[10px] land-muted">
      <span>{amountLabel(WALLET_BONUS_START_RUB, language)}</span>
      <span>{amountLabel(WALLET_BONUS_FULL_RUB, language)} · +50%</span>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PRESET_AMOUNTS_RUB.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={amountRub === preset}
          onClick={() => {
            onAmountRubChange(preset);
            setAmountInput(amountInputValue(preset, language));
          }}
          className={`min-h-10 rounded-xl border px-2 text-[11px] font-semibold transition ${amountRub === preset ? 'border-[#8db9c4] bg-white shadow-sm text-[#264856]' : 'border-white/80 bg-white/45 text-[#66818b] hover:bg-white/80'}`}
        >
          {amountLabel(preset, language)}
        </button>
      ))}
    </div>

    <div className="landing-topup-summary mt-5 space-y-3 rounded-2xl bg-white/55 p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="land-muted">{copy.topupBonus}</span>
        <strong className="landing-topup-bonus text-[#31805d]">{estimate ? `+${percentage(estimate.bonusPercent, language)}` : '—'}</strong>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-[12px] land-muted">{copy.topupBalance}</span>
        <strong className="landing-topup-value text-right text-[18px] leading-tight text-[#243f4c]">
          {estimate ? tokenBalanceLabel(estimate.walletTokens, language) : '—'}
        </strong>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--land-line)] pt-3 text-[12px]">
        <span className="land-muted">{copy.topupEffectiveRate}</span>
        <strong className="landing-topup-value text-right text-[#243f4c]">
          {estimate
            ? `${rateLabel(estimate.effectiveRateRub, language)} / ${en ? '1M' : '1 млн'}`
            : '—'}
        </strong>
      </div>
    </div>

    <p className="mt-3 text-[10px] leading-relaxed land-muted">{copy.topupAboveSlider}</p>
    <a
      href={actionHref}
      className="land-button mt-5 flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-[12px] font-semibold"
      data-testid="landing-topup-action"
    >
      {actionLabel}
      <ArrowRight size={15}/>
    </a>
    <p className="mt-3 text-[10px] leading-relaxed land-muted">{copy.topupPreviewNote}</p>
  </section>;
}
