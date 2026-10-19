import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { TOKEN_ECONOMY } from '../lib/token-economy';
import { WALLET_BONUS_FULL_RUB, walletBonusPercent } from '../lib/wallet-bonus';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import { formatUsdAmount, rublesToUsd, rublesToUsdInput, usdToRubles } from '../lib/wallet-currency';

const methods = [
  { id: 'platega', name: 'SBP', provider: 'Platega', mark: 'P' },
  { id: 'rollypay', name: 'SBP', provider: 'RollyPay', mark: 'R' },
  { id: 'bank-card', name: 'Cards', provider: 'Visa / Mastercard', mark: 'V' },
  { id: 'heleket', name: 'Heleket', provider: 'Cryptocurrency', mark: 'H' },
  { id: 'cryptobot', name: 'CryptoBot', provider: 'Telegram Crypto', mark: 'C' },
  { id: 'lzt', name: 'LZT', provider: 'Lolz Forum', mark: 'L' },
] as const;

export function WalletPaymentPreview() {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const rubFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const tokenFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const [selectedId, setSelectedId] = useState<string>(methods[0].id);
  const [amount, setAmount] = useState(() => language === 'en' ? rublesToUsdInput(500) : '500');
  const previousLanguage = useRef(language);
  const selected = methods.find((method) => method.id === selectedId) ?? methods[0];
  const displayName = (method: typeof methods[number]) => method.id === 'platega' || method.id === 'rollypay'
    ? c.sbp
    : method.id === 'bank-card' ? c.bankCards
      : method.id === 'lzt' ? c.lolzForum : method.name;
  const displayProvider = (method: typeof methods[number]) => method.id === 'heleket'
    ? c.cryptocurrency
    : method.id === 'cryptobot' ? c.telegramCrypto
      : method.id === 'lzt' ? c.lolzForum : method.provider;
  useEffect(() => {
    if (previousLanguage.current === language) return;
    const oldLanguage = previousLanguage.current;
    previousLanguage.current = language;
    const displayedAmount = Number(amount);
    const amountRub = oldLanguage === 'en' ? usdToRubles(displayedAmount) : displayedAmount;
    if (amountRub == null || !Number.isFinite(amountRub)) return;
    setAmount(language === 'en' ? rublesToUsdInput(amountRub) : String(amountRub));
  }, [amount, language]);

  const value = Number(amount);
  const valueRub = language === 'en' ? usdToRubles(value) ?? Number.NaN : value;
  const bonusPercent = walletBonusPercent(valueRub);
  const tokens = Number.isFinite(valueRub) && valueRub > 0
    ? valueRub / TOKEN_ECONOMY.rubPerMillionTokens * TOKEN_ECONOMY.tokensPerPack * (1 + bonusPercent / 100)
    : null;
  const equivalentRub = Number.isFinite(valueRub) && valueRub > 0 ? valueRub * (1 + bonusPercent / 100) : null;
  const effectiveRateRub = tokens == null ? null : valueRub / tokens * TOKEN_ECONOMY.tokensPerPack;
  const displayAmount = (rubles: number) => language === 'en'
    ? formatUsdAmount(rublesToUsd(rubles) ?? 0, locale)
    : `${rubFormat.format(rubles).replace(/[\u00a0\u202f]/g, ' ')} ₽`;
  const bonusHint = c.previewBonusHint
    .replace('{{start}}', formatUsdAmount((rublesToUsd(100) ?? 0), locale))
    .replace('{{full}}', formatUsdAmount((rublesToUsd(WALLET_BONUS_FULL_RUB) ?? 0), locale));
  const sliderAmountRub = Math.min(Math.max(Number.isSafeInteger(valueRub) ? valueRub : 100, 100), WALLET_BONUS_FULL_RUB);

  return <section className="cabinet-payment-preview" data-testid="wallet-payment-preview">
    <div className="cabinet-preview-banner" role="status">
      <strong>{c.testPreviewTitle}</strong>
      <span>{c.paymentPreviewNote}</span>
    </div>
    <div className="cabinet-topup-layout">
      <section className="cabinet-topup-config" aria-label={c.previewTopupSelect}>
        <div className="cabinet-popup-section-label">01 / {c.paymentMethod}</div>
        <div className="cabinet-preview-method-list" role="radiogroup" aria-label={c.previewMethods}>
          {methods.map((method) => <button
            key={method.id}
            type="button"
            role="radio"
            aria-checked={selectedId === method.id}
            className={`cabinet-preview-method ${selectedId === method.id ? 'selected' : ''}`}
            onClick={() => setSelectedId(method.id)}
          >
            <span className={`cabinet-preview-brand brand-${method.id}`}>{method.mark}</span>
            <span className="cabinet-preview-method-copy"><strong>{displayName(method)}</strong><small>{displayProvider(method)}</small></span>
            <i aria-hidden="true">{selectedId === method.id && <Check size={13}/>}</i>
          </button>)}
        </div>
        <div className="cabinet-quantity-block">
          <div className="cabinet-popup-section-label">{c.previewAmountSection}</div>
          <label htmlFor="cabinet-preview-amount">{c.amountInRubles}</label>
          <div className="cabinet-quantity-input">
            <span>{language === 'en' ? '$' : '₽'}</span>
            <input id="cabinet-preview-amount" type="number" min={language === 'en' ? rublesToUsdInput(100) : 100}
              step={language === 'en' ? '0.01' : '1'} inputMode="decimal"
              value={amount} onChange={(event) => setAmount(event.target.value)}/>
            <small>{language === 'en' ? 'USD' : '₽'}</small>
          </div>
          <div className="cabinet-amount-range">
            <input aria-label={c.amountSlider} data-testid="input-demo-topup-amount-slider" type="range" min="100" max={WALLET_BONUS_FULL_RUB} step="1"
              value={sliderAmountRub}
              onChange={(event) => {
                const amountRub = Number(event.target.value);
                setAmount(language === 'en' ? rublesToUsdInput(amountRub) : String(amountRub));
              }}/>
            <div><span>{displayAmount(100)}</span><span>{displayAmount(WALLET_BONUS_FULL_RUB)} · {c.bonusRange}</span></div>
          </div>
          <p className="cabinet-quantity-hint">{bonusHint}</p>
        </div>
      </section>
      <aside className="cabinet-order-summary" aria-label={c.exampleTotal}>
        <span className="cabinet-popup-section-label">{c.totalWithoutPayment}</span>
        <h3>{Number.isFinite(valueRub) && valueRub > 0 ? displayAmount(valueRub) : '—'}</h3>
        <div className="cabinet-summary-quantity">{displayName(selected)} · {displayProvider(selected)}</div>
        <dl>
          <div><dt>{c.tokenBonus}</dt><dd>+{bonusPercent.toLocaleString(locale, { maximumFractionDigits: 1 })}%</dd></div>
          <div><dt>{c.equivalent}</dt><dd>{equivalentRub == null ? '—' : displayAmount(equivalentRub)}</dd></div>
          <div><dt>{c.rate}</dt><dd>{effectiveRateRub == null ? '—' : `${displayAmount(effectiveRateRub)} / 1M`}</dd></div>
          <div><dt>{c.youWillReceive}</dt><dd>{tokens == null ? '—' : `${tokenFormat.format(tokens / TOKEN_ECONOMY.tokensPerPack)}M`}</dd></div>
        </dl>
        <button className="cabinet-popup-button primary cabinet-pay-button cabinet-preview-pay-button"
          type="button" data-testid="button-demo-payment-disabled" disabled>
          <ArrowUpRight size={15}/>{c.paymentDisabled}
        </button>
        <p className="cabinet-summary-footnote">{c.previewFootnote}</p>
      </aside>
    </div>
  </section>;
}
