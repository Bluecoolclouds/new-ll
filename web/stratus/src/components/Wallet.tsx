import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Coins, CreditCard, ExternalLink, Gift, RefreshCw, ShieldCheck, Wallet as WalletIcon, X } from 'lucide-react';
import { formatQuotaMoney, formatTimestamp, request, type SelfUser, type SystemStatus } from '../lib/api';
import { basePath } from '../lib/routes';
import { AccountHeader } from './AccountHeader';
import { quotaToWalletTokens } from '../lib/token-economy';
import { loadWalletInfo, paymentPendingKey, safeCheckoutUrl, startWalletPayment, type WalletInfo, type WalletQuote } from '../lib/wallet';
import { loadWalletOrders, walletOrderStatus, walletOrdersKey } from '../lib/wallet-history';
import { clearWalletReturnMarker } from '../lib/wallet-return';
import { WorkspaceLocaleProvider, useWorkspaceLocale } from '../lib/workspace-locale';
import { localizeWorkspaceText, workspaceLocale } from '../lib/workspace-copy';
import { formatPaymentMoney } from '../lib/wallet-currency';
import './Wallet.css';

const KEYS = {
  user: ['stratus', 'self'],
  status: ['stratus', 'status'],
  info: ['stratus', 'wallet-info'],
  quote: (method: string, usd: number) => ['stratus', 'wallet-quote', method, usd],
};
const quotePayload = (method: WalletInfo['methods'][number] | undefined, quantity: number) =>
  method?.quantity_kind === 'packs' ? { method: method.id, packs: quantity } : { method: method?.id, usd: quantity };

function sameQuote(a: WalletQuote, b: WalletQuote) {
  const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
    return JSON.stringify(value);
  };
  return a.money === b.money
    && a.currency === b.currency
    && a.credited_quota === b.credited_quota
    && a.pay_path === b.pay_path
    && stable(a.payload) === stable(b.payload);
}

function WalletContent() {
  const { language, copy: c, setLanguage } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const count = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [methodId, setMethodId] = useState('');
  const [usdInput, setUsdInput] = useState('1');
  const [dialog, setDialog] = useState<'payment' | 'redeem' | null>(null);
  const [confirmedQuote, setConfirmedQuote] = useState<WalletQuote | null>(null);
  const [redeemKey, setRedeemKey] = useState('');
  const [notice, setNotice] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const user = useQuery({ queryKey: KEYS.user, queryFn: () => request<SelfUser>('/api/user/self'), retry: false });
  const status = useQuery({ queryKey: KEYS.status, queryFn: () => request<SystemStatus>('/api/status'), retry: false });
  const info = useQuery({ queryKey: KEYS.info, queryFn: loadWalletInfo, retry: false });
  const orders = useQuery({
    queryKey: walletOrdersKey(page),
    queryFn: () => loadWalletOrders(page),
    retry: false,
    refetchInterval: (query) => (query.state.data?.items ?? []).some((item) => walletOrderStatus(item.status).className === 'pending') ? 5000 : false,
  });
  const method = info.data?.methods.find((item) => item.id === methodId);
  const quantity = Number(usdInput);
  const validQuantity = Number.isInteger(quantity) && quantity > 0
    && !!method
    && !method.disabled_reason
    && quantity >= method.min_usd
    && quantity <= method.max_usd
    && (method.product ? quantity === 1 : true);
  const quote = useQuery({
    queryKey: KEYS.quote(methodId, quantity),
    queryFn: () => request<WalletQuote>('/api/user/topup/stratus/quote', {
      method: 'POST',
      body: JSON.stringify(quotePayload(method, quantity)),
    }),
    enabled: !!method && validQuantity,
    retry: false,
    staleTime: 0,
  });

  const quotaUnit = status.data?.quota_per_unit ?? Number.NaN;
  const balance = user.data && status.data ? formatQuotaMoney(user.data.quota, quotaUnit, status.data, locale, c.unavailable) : '—';
  const spent = user.data && status.data ? formatQuotaMoney(user.data.used_quota, quotaUnit, status.data, locale, c.unavailable) : '—';
  const expectedTokens = quote.data && !quote.isError && status.data && validQuantity ? quotaToWalletTokens(quote.data.credited_quota, quotaUnit) : null;
  const confirmedTokens = confirmedQuote ? quotaToWalletTokens(confirmedQuote.credited_quota, quotaUnit) : null;
  const selectedMethodName = method?.product?.name || method?.name || '';
  const totalPages = Math.max(1, Math.ceil((orders.data?.total ?? 0) / (orders.data?.page_size ?? 10)));
  const rows = useMemo(() => orders.data?.items ?? [], [orders.data?.items]);
  const paramsHavePayment = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    try { return params.has('payment') || params.has('status') || !!sessionStorage.getItem(paymentPendingKey); }
    catch { return params.has('payment') || params.has('status'); }
  }, []);
  useEffect(() => {
    try { clearWalletReturnMarker(sessionStorage); } catch { /* Storage may be disabled. */ }
  }, []);
  const referrals = user.data as (SelfUser & { aff_quota?: number; aff_history_quota?: number; aff_count?: number }) | undefined;
  const referralsAvailable = referrals?.aff_quota != null || referrals?.aff_history_quota != null || referrals?.aff_count != null;

  const refreshAccount = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: KEYS.user }),
      client.invalidateQueries({ queryKey: ['stratus', 'wallet-orders'] }),
    ]);
  };

  const redeem = useMutation({
    mutationFn: (key: string) => request<number>('/api/user/topup', {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),
    onSuccess: async (result) => {
      const returnedQuota = typeof result === 'number' ? result : null;
      const tokens = returnedQuota == null || !status.data ? null : quotaToWalletTokens(returnedQuota, quotaUnit);
      setNotice({
        kind: 'success',
        text: tokens == null ? c.codeAccepted : c.codeCredited.replace('{{amount}}', count.format(tokens)),
      });
      setRedeemKey('');
      setDialog(null);
      await refreshAccount();
    },
    onError: (error: Error) => setNotice({ kind: 'error', text: `${c.redeemErrorPrefix}: ${error.message}` }),
  });
  const transferRewards = useMutation({
    mutationFn: (quota: number) => request<unknown>('/api/user/aff_transfer', {
      method: 'POST', body: JSON.stringify({ quota }),
    }),
    onSuccess: async () => { setNotice({ kind: 'success', text: c.referralTransferSuccess }); await refreshAccount(); },
    onError: (error: Error) => setNotice({ kind: 'error', text: `${c.referralTransferErrorPrefix}: ${error.message}` }),
  });

  const openPaymentConfirm = () => {
    if (!quote.data || quote.isFetching || quote.isError || !validQuantity || expectedTokens === null) return;
    setNotice(null);
    setConfirmedQuote(quote.data);
    setDialog('payment');
  };

  const confirmPayment = async () => {
    if (!confirmedQuote || submittingPayment || !validQuantity) return;
    setSubmittingPayment(true);
    setNotice(null);
    const displayedQuote = confirmedQuote;
    try {
      const freshQuote = await client.fetchQuery({
        queryKey: KEYS.quote(methodId, quantity),
        queryFn: () => request<WalletQuote>('/api/user/topup/stratus/quote', {
          method: 'POST',
          body: JSON.stringify(quotePayload(method, quantity)),
        }),
        staleTime: 0,
        retry: false,
      });
      if (!sameQuote(displayedQuote, freshQuote)) {
        await client.invalidateQueries({ queryKey: KEYS.quote(methodId, quantity) });
        setDialog(null);
        setNotice({ kind: 'info', text: c.quoteChanged });
        return;
      }
      setDialog(null);
      await startWalletPayment(freshQuote);
    } catch (error) {
      setNotice({ kind: 'error', text: `${c.paymentStartErrorPrefix}: ${error instanceof Error ? error.message : c.unknownError}. ${c.paymentMayExist}` });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const changeMethod = (nextId: string) => {
    setMethodId(nextId);
    const next = info.data?.methods.find((item) => item.id === nextId);
    setUsdInput(next?.product ? '1' : String(next?.min_usd ?? 1));
    setDialog(null);
    setNotice(null);
  };

  const submitRedeem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (redeemKey.trim() && !redeem.isPending) redeem.mutate(redeemKey.trim());
  };

  return <div className="wallet-page">
    <div className="wallet-shell">
      <AccountHeader active="wallet" language={language} onLanguageChange={setLanguage}/>

      <header className="wallet-heading">
        <div>
          <div className="wallet-eyebrow"><span className="wallet-eyebrow-dot"/> {c.walletPageEyebrow}</div>
          <h1>{c.walletPageTitle}</h1>
          <p className="wallet-lede">{c.walletPageDescription}</p>
        </div>
        <button className="wallet-refresh" type="button" onClick={() => void refreshAccount()} disabled={user.isFetching || orders.isFetching}>
          <RefreshCw size={14} className={user.isFetching || orders.isFetching ? 'wallet-spin' : ''}/> {c.refreshPayment}
        </button>
      </header>

      {paramsHavePayment && <div className="wallet-banner info" role="status"><Clock3 size={16}/><span>{c.paymentReviewBanner}</span></div>}
      {notice && <div className={`wallet-banner ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}><span>{localizeWorkspaceText(notice.text, language, c.unknownError)}</span><button type="button" aria-label={c.closeNotification} onClick={() => setNotice(null)}><X size={15}/></button></div>}

      <main className="wallet-layout">
        <section className="wallet-overview">
          <article className="wallet-balance-panel">
            <div className="wallet-balance-top"><span className="wallet-overline">{c.availableBalance}</span><span className="wallet-icon-orbit"><WalletIcon size={19}/></span></div>
            {user.isLoading || status.isLoading ? <div className="wallet-skeleton wallet-balance-skeleton"/> : user.data && status.data
              ? <strong className="wallet-balance-value">{balance}</strong>
              : <strong className="wallet-balance-value">{c.unavailable}</strong>}
            <div className="wallet-balance-foot"><span><span className="wallet-live-dot"/> {c.accountStatus}</span><a href={`${basePath}/dashboard`}>{c.cabinet} <ArrowUpRight size={13}/></a></div>
          </article>
          <article className="wallet-spent-panel">
            <span className="wallet-overline">{c.usedAmount}</span>
            {user.isLoading || status.isLoading ? <div className="wallet-skeleton wallet-spent-skeleton"/> : <strong>{spent}</strong>}
            <p>{c.quotaSpendDescription}</p>
            <div className="wallet-spent-rule"><span/></div>
          </article>
        </section>

        <section className="wallet-main-column">
          <section className="wallet-card wallet-topup" aria-labelledby="wallet-topup-title">
            <div className="wallet-section-head">
              <div><div className="wallet-overline">{c.topupAccount}</div><h2 id="wallet-topup-title">{c.chooseMethod}</h2></div>
              <span className="wallet-step-mark">01 <i>/ 02</i></span>
            </div>
            {info.isLoading && <div className="wallet-load-state"><span className="wallet-skeleton"/> {c.paymentMethodsLoading}</div>}
            {info.isError && <div className="wallet-error-state" role="alert"><strong>{c.paymentMethodsUnavailable}</strong><span>{c.paymentMethodsLoadHelp}</span><button className="wallet-button secondary" type="button" onClick={() => void info.refetch()}>{c.retry}</button></div>}
            {info.data && info.data.methods.length === 0 && <div className="wallet-empty"><CreditCard size={22}/><strong>{c.noPaymentMethods}</strong><span>{c.paymentMethodsNotConfigured}</span></div>}
            {info.data && info.data.methods.length > 0 && <>
              <div className="wallet-method-grid" role="radiogroup" aria-label={c.paymentMethodAria}>
                {info.data.methods.map((item, index) => <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={methodId === item.id}
                  className={`wallet-method ${methodId === item.id ? 'selected' : ''}`}
                  onClick={() => changeMethod(item.id)}
                >
                  <span className={`wallet-method-glyph glyph-${index % 3}`}>{item.product ? <Coins size={17}/> : <CreditCard size={17}/>}</span>
                   <span className="wallet-method-copy"><strong>{item.product?.name || item.name}</strong><small>{item.disabled_reason ? c.methodUnavailableHelp : item.product ? c.digitalProduct : item.quantity_kind === 'packs' ? c.packMinLabel.replace('{{min}}', count.format(item.min_usd)) : c.legacyRateMinLabel.replace('{{min}}', String(item.min_usd))}</small></span>
                  <span className="wallet-radio">{methodId === item.id && <span/>}</span>
                </button>)}
              </div>
              {method && <div className="wallet-checkout">
                 <div className="wallet-checkout-title"><div><div className="wallet-overline">{c.stepOne}</div><h3>{selectedMethodName}</h3></div><span className="wallet-lock"><ShieldCheck size={14}/> {c.protectedPayment}</span></div>
                {method.product && <div className="wallet-product-detail">
                   <span>{c.providerProduct}</span>
                   <strong>{formatPaymentMoney(method.product.price, method.product.currency, language, locale)}</strong>
                   <small>{formatQuotaMoney(method.product.quota, quotaUnit, undefined, locale, c.unavailable)} {c.currentRate}</small>
                </div>}
                 <label className="wallet-field-label" htmlFor="wallet-usd-quantity">{method.product ? c.productCount : method.quantity_kind === 'packs' ? c.packsQuantity : c.internalUsdQuantity}</label>
                <div className={`wallet-input-wrap ${method.product ? 'disabled' : ''}`}>
                  <span className="wallet-input-prefix">{method.quantity_kind === 'packs' ? '×' : '$'}</span>
                  <input id="wallet-usd-quantity" type="number" min={method.min_usd} max={method.max_usd} step="1" inputMode="numeric" value={usdInput}
                    disabled={!!method.product} onChange={(event) => setUsdInput(event.target.value)} aria-describedby="wallet-usd-help"/>
                   <span className="wallet-input-unit">{method.product || method.quantity_kind === 'packs' ? c.pieces : 'USD'}</span>
                </div>
                 <div className="wallet-field-hint" id="wallet-usd-help">{method.product ? c.quantityFixed : c.integerRange.replace('{{min}}', count.format(method.min_usd)).replace('{{max}}', count.format(method.max_usd))}</div>
                 {!method.product && method.amount_options.length > 0 && <div className="wallet-amount-options" aria-label={c.quickAmount}>
                  {method.amount_options.map((amount) => <button type="button" key={amount} className={quantity === amount ? 'active' : ''} onClick={() => setUsdInput(String(amount))}>${amount}</button>)}
                </div>}
                <div className="wallet-token-preview">
                   <div><span>{c.expectedCredit}</span><small>{c.walletTokensNotApiLimit}</small></div>
                  {quote.isLoading || quote.isFetching ? <span className="wallet-skeleton wallet-preview-skeleton"/> : expectedTokens == null
                    ? <strong className="wallet-preview-pending">—</strong>
                     : <strong>{count.format(expectedTokens)} <small>{c.tokens}</small></strong>}
                </div>
                {method.quantity_kind === 'packs' && quote.data?.bonus_percent != null && <div className="wallet-payment-total">
                   <span>{c.bonusAndEquivalent}</span>
                    <strong>+{quote.data.bonus_percent.toLocaleString(locale, { maximumFractionDigits: 1 })}% · {quote.data.equivalent_rub == null
                      ? '—' : formatPaymentMoney(quote.data.equivalent_rub, 'RUB', language, locale)}</strong>
                </div>}
                {method.disabled_reason && <div className="wallet-inline-error" role="status">{method.disabled_reason}</div>}
                 {quote.isError && validQuantity && <div className="wallet-inline-error" role="alert">{quote.error.message} <button type="button" onClick={() => void quote.refetch()}>{c.retry}</button></div>}
                  {quote.data && !quote.isError && validQuantity && <div className="wallet-payment-total"><span>{quote.data.currency ? c.serverPaymentTotal : c.stripeEstimate}</span><strong>{quote.data.currency
                    ? formatPaymentMoney(quote.data.money, quote.data.currency, language, locale)
                    : `${quote.data.money} ${c.currencyAtCheckout}`}</strong></div>}
                {(quote.data?.notice || method.notice) && <p className="wallet-conversion-note">{quote.data?.notice || method.notice}</p>}
                <button className="wallet-button primary wallet-pay-button" type="button" disabled={!quote.data || quote.isError || quote.isFetching || !validQuantity || expectedTokens === null || submittingPayment} onClick={openPaymentConfirm}>
                   <CreditCard size={16}/>{quote.isFetching ? c.quoteUpdating : submittingPayment ? c.preparingPayment : c.proceedToPayment}<ArrowUpRight size={15}/>
                </button>
                 <p className="wallet-conversion-note">{c.walletRateAndBonusNote}</p>
              </div>}
               {!method && <div className="wallet-select-hint">{c.selectPaymentHint}</div>}
            </>}
            {info.data?.topup_link && <button className="wallet-button secondary" type="button" onClick={() => {
              try { window.location.assign(safeCheckoutUrl(info.data.topup_link)); }
              catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : c.invalidTopupCodeLink }); }
             }}>{c.buyTopupCode} <ExternalLink size={14}/></button>}
             <div className="wallet-disclaimer"><CircleHelp size={14}/><span>{c.paymentDisclaimer}</span></div>
          </section>

          {info.data?.redemption && <section className="wallet-card wallet-redeem">
             <div className="wallet-section-head"><div><div className="wallet-overline">{c.haveCode}</div><h2>{c.activateKey}</h2></div><span className="wallet-redeem-icon"><Gift size={19}/></span></div>
             <p>{c.redemptionDescription}</p>
             <button type="button" className="wallet-button secondary" onClick={() => { setDialog('redeem'); setNotice(null); }}>{c.enterKey} <ArrowUpRight size={14}/></button>
          </section>}

          {referralsAvailable && <section className="wallet-card wallet-referrals">
             <div className="wallet-overline">{c.referralProgram}</div><h2>{c.referralBalance}</h2>
            <div className="wallet-referral-values">
               {referrals?.aff_quota != null && <div><span>{c.available}</span><strong>{status.data ? formatQuotaMoney(referrals.aff_quota, quotaUnit, status.data, locale, c.unavailable) : '—'}</strong></div>}
               {referrals?.aff_history_quota != null && <div><span>{c.totalCredited}</span><strong>{status.data ? formatQuotaMoney(referrals.aff_history_quota, quotaUnit, status.data, locale, c.unavailable) : '—'}</strong></div>}
               {referrals?.aff_count != null && <div><span>{c.invitedCount}</span><strong>{referrals.aff_count.toLocaleString(locale)}</strong></div>}
            </div>
            {info.data?.redemption && Number.isSafeInteger(referrals?.aff_quota) && (referrals?.aff_quota ?? 0) > 0 && <button className="wallet-button secondary" type="button" disabled={transferRewards.isPending} onClick={() => {
               const amount = formatQuotaMoney(referrals!.aff_quota!, quotaUnit, status.data, locale, c.unavailable);
               if (window.confirm(c.transferReferralConfirmation.replace('{{amount}}', amount))) transferRewards.mutate(referrals!.aff_quota!);
             }}>{transferRewards.isPending ? c.transferInProgress : c.transferToBalance}</button>}
          </section>}
        </section>

        <aside className="wallet-side-column">
           <section className="wallet-card wallet-history" aria-labelledby="wallet-history-title">
            <div className="wallet-section-head">
               <div><div className="wallet-overline">{c.serverReconciliation}</div><h2 id="wallet-history-title">{c.paymentHistoryHeading}</h2></div>
               <button className="wallet-refresh-icon" aria-label={c.refreshPaymentHistory} type="button" onClick={() => void orders.refetch()} disabled={orders.isFetching}><RefreshCw size={15} className={orders.isFetching ? 'wallet-spin' : ''}/></button>
            </div>
            {orders.isLoading && <div className="wallet-history-loading" role="status">{[0, 1, 2].map((item) => <div className="wallet-history-skeleton" key={item}><span/><i/></div>)}</div>}
             {orders.isError && <div className="wallet-empty compact" role="alert"><span>{c.paymentHistoryError}</span><button type="button" onClick={() => void orders.refetch()}>{c.retry}</button></div>}
             {orders.data && rows.length === 0 && <div className="wallet-empty compact"><Clock3 size={21}/><strong>{c.noPaymentOrders}</strong><span>{c.paymentOrdersAfterStart}</span></div>}
            {rows.length > 0 && <div className="wallet-order-list">{rows.map((item) => {
               const state = walletOrderStatus(item.status, language);
              return <article className="wallet-order" key={item.id}>
                 <div className="wallet-order-top"><span className={`wallet-status ${state.className}`}><i/>{state.label}</span><time>{formatTimestamp(Number(item.create_time), locale)}</time></div>
                 <div className="wallet-order-main"><strong>{item.money ?? '—'} {item.wallet_packs ? item.payment_currency : ''}</strong><span>{item.wallet_packs ? `${count.format(item.wallet_packs * 1_000_000)} ${c.tokens}` : c.orderAmount}</span></div>
                 <div className="wallet-order-meta"><span>{item.payment_provider || item.payment_method || c.paymentProvider}</span><span>{c.orderNumber.replace('{{id}}', String(item.trade_no || item.id))}</span></div>
                 {Number(item.complete_time) > 0 && <div className="wallet-order-complete"><Check size={12}/> {c.orderCompleted.replace('{{date}}', formatTimestamp(Number(item.complete_time), locale))}</div>}
              </article>;
            })}</div>}
            {orders.data && (page > 1 || orders.data.total > orders.data.page_size) && <div className="wallet-pager">
               <button type="button" aria-label={c.previousPage} disabled={page <= 1 || orders.isFetching} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16}/></button>
              <span>{page} / {totalPages}</span>
               <button type="button" aria-label={c.nextPage} disabled={page >= totalPages || orders.isFetching} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16}/></button>
            </div>}
             <div className="wallet-history-foot"><span className="wallet-live-dot"/> {c.autoRefreshPending}</div>
          </section>
          <section className="wallet-card wallet-explainer">
            <span className="wallet-explainer-icon"><ShieldCheck size={17}/></span>
             <div><strong>{c.paymentExplanationTitle}</strong><p>{c.paymentExplanationText}</p></div>
             <a href={`${basePath}/docs`}>{c.help} <ExternalLink size={12}/></a>
          </section>
        </aside>
      </main>
    </div>

    {dialog === 'payment' && confirmedQuote && <div className="wallet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submittingPayment) setDialog(null); }}>
      <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-confirm-title">
        <button className="wallet-modal-close" type="button" aria-label={c.close} disabled={submittingPayment} onClick={() => setDialog(null)}><X size={17}/></button>
        <span className="wallet-modal-icon"><ShieldCheck size={21}/></span>
        <div className="wallet-overline">{c.confirmBeforePayment}</div><h2 id="wallet-confirm-title">{c.confirmPayment}</h2>
        <p>{c.serverRechecksPayment}</p>
        <dl className="wallet-confirm-list">
          <div><dt>{c.paymentMethod}</dt><dd>{selectedMethodName}</dd></div>
          <div><dt>{method?.product ? c.product : method?.quantity_kind === 'packs' ? c.packsPerMillion : c.internalQuantity}</dt><dd>{method?.product ? selectedMethodName : method?.quantity_kind === 'packs' ? `${quantity} ${c.pieces}` : `${quantity} USD`}</dd></div>
          <div><dt>{confirmedQuote.currency ? c.dueNow : c.paymentEstimate}</dt><dd>{confirmedQuote.currency
            ? formatPaymentMoney(confirmedQuote.money, confirmedQuote.currency, language, locale)
            : `${confirmedQuote.money} ${c.currencyAtCheckout}`}</dd></div>
          <div><dt>{c.expectedTokens}</dt><dd>{confirmedTokens == null ? '—' : count.format(confirmedTokens)}</dd></div>
        </dl>
        {confirmedQuote.notice && <p>{confirmedQuote.notice}</p>}
        <div className="wallet-modal-actions">
          <button className="wallet-button secondary" type="button" disabled={submittingPayment} onClick={() => setDialog(null)}>{c.back}</button>
          <button className="wallet-button primary" type="button" disabled={submittingPayment} onClick={() => void confirmPayment()}>{submittingPayment ? c.checkingPaymentTerms : c.confirm} <ArrowUpRight size={14}/></button>
        </div>
      </section>
    </div>}

    {dialog === 'redeem' && <div className="wallet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !redeem.isPending) setDialog(null); }}>
      <form className="wallet-modal" onSubmit={submitRedeem} role="dialog" aria-modal="true" aria-labelledby="wallet-redeem-title">
        <button className="wallet-modal-close" type="button" aria-label={c.close} disabled={redeem.isPending} onClick={() => setDialog(null)}><X size={17}/></button>
        <span className="wallet-modal-icon redeem"><Gift size={21}/></span>
        <div className="wallet-overline">{c.redemptionActivation}</div><h2 id="wallet-redeem-title">{c.enterKey}</h2>
        <p>{c.keyServerWillCheck}</p>
        <label className="wallet-field-label" htmlFor="wallet-redemption-key">{c.redemptionKey}</label>
        <input className="wallet-redeem-input" id="wallet-redemption-key" autoComplete="off" value={redeemKey} onChange={(event) => setRedeemKey(event.target.value)} placeholder={c.redemptionKeyPlaceholder} required/>
        {redeem.isError && <div className="wallet-inline-error" role="alert">{c.redemptionFailed}</div>}
        <div className="wallet-modal-actions">
          <button className="wallet-button secondary" type="button" disabled={redeem.isPending} onClick={() => setDialog(null)}>{c.cancel}</button>
          <button className="wallet-button primary" type="submit" disabled={!redeemKey.trim() || redeem.isPending}>{redeem.isPending ? c.checkingCode : c.activate} <ArrowUpRight size={14}/></button>
        </div>
      </form>
    </div>}
  </div>;
}

export function Wallet() {
  return <WorkspaceLocaleProvider><WalletContent/></WorkspaceLocaleProvider>;
}
