/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { submitWithdrawal } from '../../api'
import { QUOTA_PER_DOLLAR } from '../../constants'

interface WithdrawDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableQuota: number
  onSuccess: () => void
}

type Method = 'sbp' | 'crypto'
type CryptoNetwork = 'trc20' | 'ton'

const BLANK_SBP = { phone: '', bank: '' }
const BLANK_CRYPTO = { network: 'trc20' as CryptoNetwork, address: '' }

export function WithdrawDialog({
  open,
  onOpenChange,
  availableQuota,
  onSuccess,
}: WithdrawDialogProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [method, setMethod] = useState<Method>('sbp')
  const [amountUSD, setAmountUSD] = useState('')
  const [sbp, setSbp] = useState(BLANK_SBP)
  const [crypto, setCrypto] = useState(BLANK_CRYPTO)

  const MIN_WITHDRAWAL_USD = 10
  const availableUSD = availableQuota / QUOTA_PER_DOLLAR

  useEffect(() => {
    if (open) {
      setMethod('sbp')
      setAmountUSD(availableUSD > 0 ? availableUSD.toFixed(2) : '')
      setSbp(BLANK_SBP)
      setCrypto(BLANK_CRYPTO)
    }
  }, [open, availableUSD])

  const handleSubmit = async () => {
    const usd = parseFloat(amountUSD)
    if (isNaN(usd) || usd <= 0) {
      toast.error(t('Please enter a valid amount'))
      return
    }
    if (usd < MIN_WITHDRAWAL_USD) {
      toast.error(t('Minimum withdrawal amount is $10'))
      return
    }
    if (usd > availableUSD) {
      toast.error(t('Amount exceeds available balance'))
      return
    }

    let details: Record<string, string>
    if (method === 'sbp') {
      if (!sbp.phone.trim() || !sbp.bank.trim()) {
        toast.error(t('Please fill in all fields'))
        return
      }
      details = { phone: sbp.phone.trim(), bank: sbp.bank.trim() }
    } else {
      if (!crypto.address.trim()) {
        toast.error(t('Please enter wallet address'))
        return
      }
      details = { network: crypto.network, address: crypto.address.trim() }
    }

    const quotaAmount = Math.round(usd * QUOTA_PER_DOLLAR)

    setSubmitting(true)
    try {
      const res = await submitWithdrawal({
        amount: quotaAmount,
        method,
        details: JSON.stringify(details),
      })
      if (res.success) {
        toast.success(t('Withdrawal request submitted successfully'))
        onSuccess()
        onOpenChange(false)
      } else {
        toast.error(res.message || t('Failed to submit withdrawal request'))
      }
    } catch {
      toast.error(t('Failed to submit withdrawal request'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Withdraw')}</DialogTitle>
          <DialogDescription>
            {t('Available balance')}: ${availableUSD.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4 py-2'>
          <div className='flex flex-col gap-1.5'>
            <Label>{t('Amount (USD)')}</Label>
            <Input
              type='number'
              min='0.01'
              step='0.01'
              max={availableUSD}
              placeholder='0.00'
              value={amountUSD}
              onChange={(e) => setAmountUSD(e.target.value)}
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label>{t('Withdrawal method')}</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as Method)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='sbp'>{t('SBP (Russia)')}</SelectItem>
                <SelectItem value='crypto'>{t('Crypto')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === 'sbp' && (
            <>
              <div className='flex flex-col gap-1.5'>
                <Label>{t('Phone number')}</Label>
                <Input
                  placeholder='+7 900 000 00 00'
                  value={sbp.phone}
                  onChange={(e) => setSbp((s) => ({ ...s, phone: e.target.value }))}
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label>{t('Bank name')}</Label>
                <Input
                  placeholder={t('e.g. Sberbank')}
                  value={sbp.bank}
                  onChange={(e) => setSbp((s) => ({ ...s, bank: e.target.value }))}
                />
              </div>
            </>
          )}

          {method === 'crypto' && (
            <>
              <div className='flex flex-col gap-1.5'>
                <Label>{t('Network')}</Label>
                <Select
                  value={crypto.network}
                  onValueChange={(v) =>
                    setCrypto((s) => ({ ...s, network: v as CryptoNetwork }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='trc20'>USDT TRC-20</SelectItem>
                    <SelectItem value='ton'>TON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label>{t('Wallet address')}</Label>
                <Input
                  placeholder={t('Enter wallet address')}
                  value={crypto.address}
                  onChange={(e) =>
                    setCrypto((s) => ({ ...s, address: e.target.value }))
                  }
                  className='font-mono text-xs'
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className='mr-2 size-4 animate-spin' />}
            {t('Submit request')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
