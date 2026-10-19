import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Clock3, History, RefreshCw } from 'lucide-react';
import { formatTimestamp } from '../lib/api';
import { basePath } from '../lib/routes';
import { loadWalletOrders, walletOrderStatus, walletOrdersKey } from '../lib/wallet-history';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import './Wallet.css';
import './topup-history.css';

export function TopupHistory() {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const count = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const [page, setPage] = useState(1);
  const orders = useQuery({
    queryKey: walletOrdersKey(page),
    queryFn: () => loadWalletOrders(page),
    retry: false,
    refetchInterval: (query) => (query.state.data?.items ?? []).some((item) => walletOrderStatus(item.status).className === 'pending') ? 5000 : false,
  });
  const rows = useMemo(() => orders.data?.items ?? [], [orders.data?.items]);
  const totalPages = Math.max(1, Math.ceil((orders.data?.total ?? 0) / (orders.data?.page_size ?? 10)));

  return <section className="wallet-page settings-topup-history">
    <section className="wallet-card wallet-history" aria-labelledby="settings-topup-history-title">
      <div className="wallet-section-head">
        <div><div className="wallet-overline">{c.serverReconciliation}</div><h2 id="settings-topup-history-title">{c.topupHistoryHeading}</h2></div>
        <button className="wallet-refresh-icon" aria-label={c.refreshTopupHistory} type="button" onClick={() => void orders.refetch()} disabled={orders.isFetching}>
          <RefreshCw size={15} className={orders.isFetching ? 'wallet-spin' : ''}/>
        </button>
      </div>
      <p className="settings-topup-history-intro">{c.topupHistoryIntro}</p>
      {orders.isLoading && <div className="wallet-history-loading" role="status">{[0, 1, 2].map((item) => <div className="wallet-history-skeleton" key={item}><span/><i/></div>)}</div>}
      {orders.isError && <div className="wallet-empty compact" role="alert"><span>{c.topupHistoryError}</span><button type="button" onClick={() => void orders.refetch()}>{c.retry}</button></div>}
      {orders.data && rows.length === 0 && <div className="wallet-empty compact"><Clock3 size={21}/><strong>{c.noTopupsTitle}</strong><span>{c.noTopupsHelp}</span></div>}
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
    <a className="settings-topup-history-link" href={`${basePath}/wallet`}><History size={14}/> {c.goToTopup}</a>
  </section>;
}
