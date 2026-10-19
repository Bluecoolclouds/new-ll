export const paymentPendingKey = 'stratus-wallet-payment-pending';

export function walletReturnTarget(storage: Pick<Storage, 'getItem'>): string | null {
  try {
    const pending: unknown = JSON.parse(storage.getItem(paymentPendingKey) || 'null');
    if (!pending || typeof pending !== 'object' || !('wallet' in pending)) return null;
    const wallet = pending.wallet;
    return wallet === '/wallet' || wallet === '/stratus/wallet' ? `${wallet}?payment=return` : null;
  } catch { return null; }
}

export function clearWalletReturnMarker(storage: Pick<Storage, 'removeItem'>): void {
  try { storage.removeItem(paymentPendingKey); } catch { /* Storage may be disabled; it is not the payment authority. */ }
}
