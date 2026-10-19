import { request, type Page } from './api';
import { workspaceCopyFor, type WorkspaceLanguage } from './workspace-copy';

export type WalletOrder = {
  id: number | string;
  amount: number | string;
  money: string;
  trade_no: string;
  payment_method: string;
  payment_provider: string;
  payment_currency?: string;
  wallet_packs?: number;
  create_time: string | number;
  complete_time: string | number | null;
  status: number | string;
};

export const walletOrdersKey = (page: number) => ['stratus', 'wallet-orders', page] as const;

export const loadWalletOrders = (page: number) =>
  request<Page<WalletOrder>>(`/api/user/topup/self?p=${page}&page_size=10`);

export function walletOrderStatus(status: WalletOrder['status'], language: WorkspaceLanguage = 'ru') {
  const value = String(status).toLocaleLowerCase(language);
  const copy = workspaceCopyFor(language);
  if (value === 'success') return { label: copy.orderStatusPaid, className: 'success' };
  if (value === 'pending') return { label: copy.orderStatusPending, className: 'pending' };
  if (value === 'expired') return { label: copy.orderStatusExpired, className: 'expired' };
  if (value === 'failed' || value === 'error') return { label: copy.orderStatusFailed, className: 'failed' };
  return { label: `${copy.orderStatusUnknown} · ${String(status)}`, className: 'unknown' };
}
