import { expect, test } from 'bun:test'
import { walletOrderStatus } from '../src/lib/wallet-history'

test('wallet payment statuses follow the selected language without changing their state class', () => {
  expect(walletOrderStatus('success').label).toBe('Оплачен')
  expect(walletOrderStatus('success', 'en')).toEqual({ label: 'Paid', className: 'success' })
  expect(walletOrderStatus('pending', 'en')).toEqual({ label: 'Awaiting payment', className: 'pending' })
  expect(walletOrderStatus('expired', 'en').className).toBe('expired')
  expect(walletOrderStatus('failed', 'en').label).toBe('Failed')
  expect(walletOrderStatus('new-status', 'en').label).toBe('Unknown status · new-status')
})
