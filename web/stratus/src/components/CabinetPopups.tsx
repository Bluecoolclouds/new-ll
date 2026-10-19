import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, Clipboard, CreditCard, RefreshCw, Users, Wallet, X } from 'lucide-react';
import { TOKEN_ECONOMY, quotaToWalletTokens } from '../lib/token-economy';
import { WALLET_BONUS_FULL_RUB, WALLET_BONUS_START_RUB, walletBonusPercent } from '../lib/wallet-bonus';
import { request, type SelfUser, type SystemStatus } from '../lib/api';
import { basePath } from '../lib/routes';
import { startWalletPayment, type WalletInfo } from '../lib/wallet';
import { buildReferralUrl, isValidWalletQuote, normalizeWalletInfo, sameWalletQuote, walletQuotePayload } from '../lib/cabinet-popup-helpers';
import { localizeWorkspaceText, workspaceLocale } from '../lib/workspace-copy';
import { formatPaymentMoney, formatUsdAmount, rublesToUsd, rublesToUsdInput, usdToRubles } from '../lib/wallet-currency';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { WalletPaymentPreview } from './WalletPaymentPreview';
import './cabinet-popups.css';

type CabinetUser = SelfUser & {
  aff_count?: number;
  aff_quota?: number;
  aff_history_quota?: number;
  aff_code?: string;
};

const walletInfoKey = ['stratus', 'cabinet-wallet-info'];

function CabinetDialog({ title, description, children, onClose, labelledBy, describedBy, className = '', closeDisabled = false, hideHeading = false }: {
  title: string; description?: string; children: ReactNode; onClose: () => void;
  labelledBy: string; describedBy?: string; className?: string; closeDisabled?: boolean; hideHeading?: boolean;
}) {
  const { copy: c } = useWorkspaceLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  const dismiss = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onCloseRef.current();
  };
  return createPortal(
    <dialog
      ref={dialogRef}
      className={`cabinet-dialog ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(event) => { event.preventDefault(); if (!closeDisabled) dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !closeDisabled) dismiss(); }}
    >
      <div className="cabinet-dialog-frame">
        <button className="cabinet-dialog-close" type="button" aria-label={c.closeDialog} disabled={closeDisabled} onClick={dismiss}><X size={18}/></button>
        {!hideHeading && <div className="cabinet-dialog-heading">
          <span className="cabinet-dialog-mark"><Wallet size={19}/></span>
          <div><span className="cabinet-dialog-kicker">{title}</span>{description && <p id={describedBy}>{description}</p>}</div>
        </div>}
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

function fetchWalletInfo() {
  return request<unknown>('/api/user/topup/stratus/info').then(normalizeWalletInfo);
}

function quoteKey(method: string, quantity: number) {
  return ['stratus', 'cabinet-wallet-quote', method, quantity];
}

export function TopupDialog({ onClose, isAdmin = false }: { onClose: () => void; isAdmin?: boolean }) {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const countFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const integerFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const millionFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const bonusFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const client = useQueryClient();
  const [methodId, setMethodId] = useState('');
  const [quantityText, setQuantityText] = useState('');
  const [previewOverride, setPreviewOverride] = useState<boolean | null>(null);
  const [redeemKey, setRedeemKey] = useState('');
  const [paymentMessage, setPaymentMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [redeemMessage, setRedeemMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const previousLanguage = useRef(language);
  const info = useQuery({ queryKey: walletInfoKey, queryFn: fetchWalletInfo, retry: false });
  const status = useQuery({ queryKey: ['stratus', 'status'], queryFn: () => request<SystemStatus>('/api/status'), retry: false });
  const methods = info.data?.methods ?? [];
  const autoPreview = !info.isLoading && (info.isError || (!!info.data && methods.length === 0));
  const previewMode = isAdmin && (previewOverride ?? autoPreview);
  const method = previewMode ? undefined : methods.find((item) => item.id === methodId);
  const quantity = Number(quantityText);
  const packPurchase = method?.quantity_kind === 'packs';
  const quantityRub = packPurchase && language === 'en' ? usdToRubles(quantity) ?? Number.NaN : quantity;
  const quantityForServer = packPurchase ? quantityRub : quantity;
  const minimumRub = packPurchase ? Math.max(100, method.min_amount_rub ?? 100) : 0;
  const sliderMaxRub = Math.max(WALLET_BONUS_FULL_RUB, minimumRub);
  const validQuantity = !!method && !method.disabled_reason && Number.isSafeInteger(packPurchase ? quantityRub : quantity)
    && (packPurchase
      ? quantityRub >= minimumRub
      : quantity > 0 && quantity >= method.min_usd && quantity <= method.max_usd && (!method.product || quantity === 1));
  const quoteQuery = useQuery({
      queryKey: quoteKey(methodId, quantityForServer),
    queryFn: () => request<unknown>('/api/user/topup/stratus/quote', {
      method: 'POST',
      body: JSON.stringify(walletQuotePayload(method!, quantityForServer)),
    }).then((result) => {
      if (!isValidWalletQuote(result)) throw new Error(c.invalidPaymentQuote);
      return result;
    }),
    enabled: !previewMode && !!method && validQuantity,
    retry: false,
    staleTime: 0,
  });
  const quote = quoteQuery.data;
  const quotaUnit = status.data?.quota_per_unit ?? Number.NaN;
  const creditedTokens = quote ? quotaToWalletTokens(quote.credited_quota, quotaUnit) : null;
  const effectiveRate = quote?.effective_rate_rub ?? (quote && creditedTokens != null && creditedTokens > 0
    ? Number(quote.money) / creditedTokens * 1_000_000 : null);
  const chosenName = method?.product?.name || method?.name || '';
  const packAmountInput = (amountRub: number) => language === 'en' ? rublesToUsdInput(amountRub) : String(amountRub);
  const packAmountLabel = (amountRub: number) => language === 'en'
    ? formatUsdAmount(rublesToUsd(amountRub) ?? 0, locale)
    : `${integerFormat.format(amountRub)} ₽`;
  const bonusDescription = packPurchase && language === 'en'
    ? c.gradualBonus
      .replace('{{start}}', formatUsdAmount(rublesToUsd(WALLET_BONUS_START_RUB) ?? 0, locale))
      .replace('{{full}}', formatUsdAmount(rublesToUsd(WALLET_BONUS_FULL_RUB) ?? 0, locale))
    : c.gradualBonus;
  const displayRate = effectiveRate == null ? null
    : language === 'en'
      ? formatPaymentMoney(effectiveRate, quote?.currency ?? '', language, locale)
      : `${countFormat.format(effectiveRate)} ${quote?.currency ?? ''}`;
  const redemption = useMutation({
    mutationFn: (key: string) => request<unknown>('/api/user/topup', { method: 'POST', body: JSON.stringify({ key }) }),
    onSuccess: async () => {
      setRedeemMessage({ kind: 'info', text: c.codeAccepted });
      setRedeemKey('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['stratus', 'self'] }),
        client.invalidateQueries({ queryKey: ['stratus', 'wallet-orders'] }),
      ]);
    },
    onError: (error: Error) => setRedeemMessage({ kind: 'error', text: `${c.redeemErrorPrefix}: ${error.message}` }),
  });

  useEffect(() => {
    if (!method) return;
    setQuantityText(method.product ? '1' : method.quantity_kind === 'packs'
      ? packAmountInput(Math.max(100, method.min_amount_rub ?? 100))
      : String(method.min_usd));
    setPaymentMessage(null);
  }, [methodId]); // method changes only when the server selection changes

  useEffect(() => {
    if (previousLanguage.current === language) return;
    const oldLanguage = previousLanguage.current;
    previousLanguage.current = language;
    if (!packPurchase || !quantityText.trim()) return;
    const enteredAmount = Number(quantityText);
    const amountRub = oldLanguage === 'en' ? usdToRubles(enteredAmount) : enteredAmount;
    if (amountRub != null && Number.isFinite(amountRub)) setQuantityText(packAmountInput(amountRub));
  }, [language, methodId, packPurchase, quantityText]);

  const chooseMethod = (item: WalletInfo['methods'][number]) => {
    setMethodId(item.id);
    setQuantityText(item.product ? '1' : item.quantity_kind === 'packs'
      ? packAmountInput(Math.max(100, item.min_amount_rub ?? 100))
      : String(item.min_usd));
    setPaymentMessage(null);
  };

  const beginPayment = async () => {
    if (previewMode || submitLock.current || !method || !validQuantity || !quote || !isValidWalletQuote(quote)) return;
    submitLock.current = true;
    setSubmitting(true);
    setPaymentMessage(null);
    try {
      const refreshed = await request<unknown>('/api/user/topup/stratus/quote', {
        method: 'POST', body: JSON.stringify(walletQuotePayload(method, quantityForServer)),
      });
      if (!isValidWalletQuote(refreshed)) throw new Error(c.invalidUpdatedQuote);
      if (!sameWalletQuote(quote, refreshed)) {
        client.setQueryData(quoteKey(method.id, quantityForServer), refreshed);
        setPaymentMessage({ kind: 'info', text: c.quoteChanged });
        return;
      }
      await startWalletPayment(refreshed);
    } catch (error) {
      setPaymentMessage({
        kind: 'error',
        text: `${c.paymentStartErrorPrefix}: ${error instanceof Error ? error.message : c.unknownError}. ${c.paymentMayExist}`,
      });
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const submitRedeem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (redeemKey.trim() && !redemption.isPending) {
      setRedeemMessage(null);
      redemption.mutate(redeemKey.trim());
    }
  };

  return <CabinetDialog title={c.topupWallet}
    description={previewMode ? c.testPaymentPreview : c.serverPaymentMethods}
    labelledBy="cabinet-topup-title" describedBy="cabinet-topup-description" className="cabinet-topup-dialog"
    closeDisabled={submitting || redemption.isPending} onClose={onClose}>
    <h2 className="cabinet-dialog-title" id="cabinet-topup-title">{c.topupHeading}</h2>
    {isAdmin && <button className="cabinet-popup-button secondary cabinet-preview-toggle" type="button"
      onClick={() => setPreviewOverride(!previewMode)}>
      {previewMode ? c.showConfiguredMethods : c.testMethodsPreview}
    </button>}
    {info.data?.redemption && !previewMode && <section className="cabinet-inline-redeem" aria-labelledby="cabinet-redeem-heading">
      <div className="cabinet-popup-section-label" id="cabinet-redeem-heading">{c.redemptionCode}</div>
      <form className="cabinet-redeem-form" onSubmit={submitRedeem}>
        <label htmlFor="cabinet-redeem-key">{c.redemptionLabel}</label>
        <div className="cabinet-redeem-entry">
          <input id="cabinet-redeem-key" value={redeemKey} disabled={redemption.isPending}
            onChange={(event) => { setRedeemKey(event.target.value); setRedeemMessage(null); }}
            autoComplete="off" placeholder={c.redemptionPlaceholder} required />
          <button type="submit" className="cabinet-popup-button primary" disabled={!redeemKey.trim() || redemption.isPending}>
            {redemption.isPending ? c.checkingCode : c.activate}
          </button>
        </div>
        {redeemMessage && <p className={`cabinet-popup-message ${redeemMessage.kind}`} role={redeemMessage.kind === 'error' ? 'alert' : 'status'}>{localizeWorkspaceText(redeemMessage.text, language, c.redeemErrorPrefix)}</p>}
      </form>
    </section>}
    {previewMode && <WalletPaymentPreview/>}
    {info.isLoading && !previewMode && <div className="cabinet-popup-loading" role="status"><i/><i/><span>{c.paymentMethodsLoading}</span></div>}
    {info.isError && !previewMode && <div className="cabinet-popup-error" role="alert"><strong>{c.paymentMethodsUnavailable}</strong><span>{info.error.message}</span><button className="cabinet-popup-button secondary" type="button" onClick={() => void info.refetch()} disabled={info.isFetching}><RefreshCw size={14}/> {c.retry}</button></div>}
    {info.data && !previewMode && methods.length === 0 && <div className="cabinet-popup-empty"><CreditCard size={20}/><strong>{c.noPaymentMethods}</strong><span>{c.paymentMethodsNotConfigured}</span></div>}
    {info.data && !previewMode && methods.length > 0 && <div className="cabinet-topup-layout">
        <section className="cabinet-topup-config" aria-label={c.choosePaymentOptions}>
          <div className="cabinet-popup-section-label">01 / {c.paymentMethod}</div>
          <div className="cabinet-method-list" role="radiogroup" aria-label={c.paymentMethodAria}>
            {methods.map((item) => <button key={item.id} type="button" role="radio" aria-checked={methodId === item.id}
              className={`cabinet-method ${methodId === item.id ? 'selected' : ''}`} disabled={submitting} onClick={() => chooseMethod(item)}>
              <span className="cabinet-method-icon"><CreditCard size={16}/></span>
               <span><strong>{item.product?.name || item.name}</strong><small>{item.disabled_reason || (item.quantity_kind === 'packs' ? c.tokenPacks : item.product ? c.serverProduct : c.serverCalculatedPayment)}</small>{item.product && <small>{formatPaymentMoney(item.product.price, item.product.currency, language, locale)}</small>}</span>
              <i aria-hidden="true">{methodId === item.id ? <Check size={13}/> : null}</i>
            </button>)}
          </div>
          {method && <div className="cabinet-quantity-block">
            <div className="cabinet-popup-section-label">02 / {c.quantity}</div>
            <label htmlFor="cabinet-quantity">{method.product ? c.productQuantity : packPurchase ? c.topupAmount : c.internalUsdQuantity}</label>
            <div className="cabinet-quantity-input">
               <span>{packPurchase ? language === 'en' ? '$' : '₽' : method.product ? '×' : '$'}</span>
               <input id="cabinet-quantity" type="number"
                 min={packPurchase ? language === 'en' ? rublesToUsdInput(minimumRub) : minimumRub : method.min_usd}
                  max={packPurchase ? language === 'en' ? Number.MAX_SAFE_INTEGER / TOKEN_ECONOMY.usdToRub : Number.MAX_SAFE_INTEGER : method.max_usd}
                 step={packPurchase && language === 'en' ? '0.01' : '1'} inputMode={packPurchase && language === 'en' ? 'decimal' : 'numeric'}
                value={quantityText} disabled={submitting || !!method.product || !!method.disabled_reason}
                onChange={(event) => { setQuantityText(event.target.value); setPaymentMessage(null); }}/>
               <small>{packPurchase ? language === 'en' ? 'USD' : 'RUB' : method.product ? c.pieces : 'USD'}</small>
            </div>
            {packPurchase && <div className="cabinet-amount-range">
              <input aria-label={c.amountSlider} data-testid="input-topup-amount-slider" type="range" min={minimumRub}
                max={sliderMaxRub} step="1"
                value={Math.min(Math.max(Number.isSafeInteger(quantityRub) ? quantityRub : minimumRub, minimumRub), sliderMaxRub)}
                disabled={submitting || !!method.disabled_reason || minimumRub >= WALLET_BONUS_FULL_RUB}
                onChange={(event) => { setQuantityText(packAmountInput(Number(event.target.value))); setPaymentMessage(null); }}/>
              <div><span>{packAmountLabel(minimumRub)}</span><span>{packAmountLabel(sliderMaxRub)} · +{bonusFormat.format(walletBonusPercent(sliderMaxRub))}%</span></div>
            </div>}
            <p className="cabinet-quantity-hint">{method.product ? c.productQuantityServer
              : packPurchase ? bonusDescription
                : c.integerRange.replace('{{min}}', integerFormat.format(method.min_usd)).replace('{{max}}', integerFormat.format(method.max_usd))}</p>
            {!packPurchase && !method.product && <p className="cabinet-method-notice">{c.bonusOnlyForPacks}</p>}
            {!packPurchase && !method.product && method.amount_options.length > 0 && <div className="cabinet-amount-options" aria-label={c.availableAmounts}>
              {method.amount_options.filter((option) => option >= method.min_usd && option <= method.max_usd).map((option) =>
                <button type="button" key={option} disabled={submitting || !!method.disabled_reason} className={quantity === option ? 'active' : ''} onClick={() => { setQuantityText(String(option)); setPaymentMessage(null); }}>
                  {`${option} USD`}
                </button>)}
            </div>}
            {method.notice && <p className="cabinet-method-notice">{method.notice}</p>}
          </div>}
        </section>
        <aside className="cabinet-order-summary" aria-live="polite">
          <span className="cabinet-popup-section-label">{packPurchase ? c.grandTotal : c.serverQuote}</span>
          <h3>{packPurchase && validQuantity ? packAmountLabel(quantityRub) : chosenName || c.choosePaymentMethod}</h3>
          {method && <div className="cabinet-summary-quantity">{packPurchase ? chosenName : method.product ? chosenName : `${quantityText || '—'} USD`}</div>}
          <dl>
            <div><dt>{c.dueNow}</dt><dd>{quote && !quoteQuery.isError ? formatPaymentMoney(quote.money, quote.currency, language, locale) : '—'}</dd></div>
            {packPurchase && <div><dt>{c.tokenBonus}</dt><dd>{quote?.bonus_percent == null ? '—' : `+${bonusFormat.format(quote.bonus_percent)}%`}</dd></div>}
            {packPurchase && <div><dt>{c.equivalent}</dt><dd>{quote?.equivalent_rub == null ? '—' : packAmountLabel(quote.equivalent_rub)}</dd></div>}
            {packPurchase && <div><dt>{c.rate}</dt><dd>{quote?.effective_rate_rub == null ? '—' : `${formatUsdAmount(rublesToUsd(quote.effective_rate_rub) ?? 0, locale)} / 1M`}</dd></div>}
            <div><dt>{packPurchase ? c.youWillReceive : c.credit}</dt><dd>{creditedTokens == null ? '—' : packPurchase
              ? `${millionFormat.format(creditedTokens / 1_000_000)}M`
              : `${countFormat.format(creditedTokens)} ${c.tokens}`}</dd></div>
            {!packPurchase && displayRate != null && <div><dt>{c.perMillionTokens}</dt><dd>{displayRate}</dd></div>}
          </dl>
          {quote?.notice && <p className="cabinet-quote-notice">{quote.notice}</p>}
          {quoteQuery.isFetching && <div className="cabinet-quote-loading" role="status">{c.quoteUpdating}</div>}
          {quoteQuery.isError && validQuantity && <div className="cabinet-popup-message error" role="alert">{quoteQuery.error.message}<button type="button" onClick={() => void quoteQuery.refetch()} disabled={quoteQuery.isFetching}>{c.quoteRetry}</button></div>}
          {method?.disabled_reason && <div className="cabinet-popup-message info" role="status">{method.disabled_reason}</div>}
          {paymentMessage && <p className={`cabinet-popup-message ${paymentMessage.kind}`} role={paymentMessage.kind === 'error' ? 'alert' : 'status'}>{localizeWorkspaceText(paymentMessage.text, language, c.paymentStartErrorPrefix)}</p>}
          <button className="cabinet-popup-button primary cabinet-pay-button" type="button"
            disabled={!quote || quoteQuery.isFetching || !!quoteQuery.isError || !validQuantity || creditedTokens == null || submitting}
            onClick={() => void beginPayment()}>
            <ArrowUpRight size={15}/>{submitting ? c.checkingPaymentTerms : c.proceedToPayment}
          </button>
          <p className="cabinet-summary-footnote">{c.serverQuoteFootnote}</p>
          <a className="cabinet-history-link" href={`${basePath}/wallet`}>{c.walletPaymentHistory} <ArrowUpRight size={13}/></a>
        </aside>
      </div>}
  </CabinetDialog>;
}

export function InviteDialog({ user, quotaPerUnit, referralPercent, onClose }: {
  user?: CabinetUser; quotaPerUnit: number; referralPercent?: number; onClose: () => void;
}) {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const countFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const integerFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const linkRef = useRef<HTMLTextAreaElement>(null);
  const codeQuery = useQuery({
    queryKey: ['stratus', 'referral-code', user?.id],
    queryFn: () => request<unknown>('/api/user/aff').then((value) => {
      const code = typeof value === 'string' ? value.trim() : '';
      if (!code) throw new Error(c.missingReferralLink);
      return code;
    }),
    retry: false,
  });
  const referralUrl = codeQuery.data && typeof window !== 'undefined'
    ? buildReferralUrl(window.location.origin, basePath, codeQuery.data) : '';
  const invited = Number.isSafeInteger(user?.aff_count) && (user?.aff_count ?? -1) >= 0 ? integerFormat.format(user!.aff_count!) : null;
  const earnedTokens = user?.aff_history_quota == null ? null : quotaToWalletTokens(user.aff_history_quota, quotaPerUnit);
  const rewardPercent = typeof referralPercent === 'number' && Number.isFinite(referralPercent) && referralPercent > 0 && referralPercent <= 100
    ? referralPercent : null;
  const rewardDescription = rewardPercent == null
    ? c.referralTermsUnavailable
    : c.referralReward.replace('{{percent}}', String(rewardPercent));

  const copy = async () => {
    if (!referralUrl) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(referralUrl);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
      linkRef.current?.focus();
      linkRef.current?.select();
    }
  };

  return <CabinetDialog title={c.invitedFriends} description={rewardDescription}
    labelledBy="cabinet-invite-title" describedBy="cabinet-invite-description" className="cabinet-invite-dialog" hideHeading onClose={onClose}>
    <div className="cabinet-invite-hero"><span className="cabinet-invite-icon"><Users size={20}/></span><div>
      <h2 className="cabinet-dialog-title" id="cabinet-invite-title">{c.invitedFriends}</h2>
      <p id="cabinet-invite-description">{rewardDescription}</p>
    </div></div>
    <div className="cabinet-referral-content">
      <div className="cabinet-referral-link-block">
        <span>{c.yourLink}</span>
        {codeQuery.isLoading && <div className="cabinet-referral-skeleton" role="status">{c.creatingLink}</div>}
        {codeQuery.isError && <div className="cabinet-popup-message error" role="alert"><span>{localizeWorkspaceText(codeQuery.error.message, language, c.missingReferralLink)}</span><button type="button" onClick={() => void codeQuery.refetch()} disabled={codeQuery.isFetching}>{c.retry}</button></div>}
        {referralUrl && <textarea ref={linkRef} className="cabinet-referral-url" aria-label={c.yourLink}
          readOnly rows={3} value={referralUrl} onFocus={(event) => event.currentTarget.select()}/>}
      </div>
      <div className="cabinet-referral-stats">
        <div><span>{c.invitedCount}</span><strong>{invited ?? c.unavailable}</strong></div>
        <div><span>{c.bonusesEarned}</span><strong>{earnedTokens == null ? c.unavailable : `${countFormat.format(earnedTokens)} ${c.tokens}`}</strong></div>
      </div>
    </div>
    {copyState === 'manual' && referralUrl && <div className="cabinet-manual-copy" role="alert">
      {c.copyReferralManual}
    </div>}
    <div className="cabinet-popup-actions">
      <button className="cabinet-popup-button primary" type="button" onClick={() => void copy()} disabled={!referralUrl}>
        {copyState === 'copied' ? <Check size={15}/> : <Clipboard size={15}/>}
        {copyState === 'copied' ? c.referralLinkCopied : c.copyReferralLink}
      </button>
      <button className="cabinet-popup-button secondary" type="button" onClick={onClose}><X size={14}/> {c.close}</button>
    </div>
    <p className="cabinet-invite-note">{c.referralNote}</p>
  </CabinetDialog>;
}
