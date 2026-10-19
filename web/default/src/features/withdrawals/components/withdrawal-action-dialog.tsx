import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminUpdateWithdrawal, type WithdrawalRecord } from '@/features/wallet/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatQuota } from '@/lib/format'

interface WithdrawalActionDialogProps {
  open: boolean
  action: 'approve' | 'reject' | null
  record: WithdrawalRecord
  onClose: () => void
  onSuccess: () => void
}

export function WithdrawalActionDialog({
  open,
  action,
  record,
  onClose,
  onSuccess,
}: WithdrawalActionDialogProps) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const isApprove = action === 'approve'

  const handleConfirm = async () => {
    if (!action) return
    if (!isApprove && !note.trim()) {
      toast.error(t('Please enter a rejection reason'))
      return
    }
    setLoading(true)
    try {
      const status = action === 'approve' ? 'approved' : 'rejected'
      const res = await adminUpdateWithdrawal(record.id, status, note.trim())
      if (res.success) {
        toast.success(isApprove ? t('Withdrawal approved') : t('Withdrawal rejected'))
        setNote('')
        onSuccess()
      } else {
        toast.error(res.message || t('Operation failed'))
      }
    } catch {
      toast.error(t('Operation failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setNote('')
    onClose()
  }

  const methodLabel = record.method === 'sbp' ? 'СБП' : record.method === 'crypto' ? 'Крипто' : record.method

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? t('Approve withdrawal') : t('Reject withdrawal')}
          </DialogTitle>
          <DialogDescription className='space-y-1 pt-1'>
            <span className='block'>
              {t('User')}: <span className='font-medium text-foreground'>{record.username || `#${record.user_id}`}</span>
            </span>
            <span className='block'>
              {t('Amount')}: <span className='font-mono font-semibold text-emerald-600'>{formatQuota(record.amount)}</span>
            </span>
            <span className='block'>
              {t('Method')}: <span className='font-medium text-foreground'>{methodLabel}</span>
            </span>
            <span className='block font-mono text-xs break-all'>
              {record.details}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-2'>
          <Label htmlFor='note'>
            {isApprove ? t('Note (optional)') : t('Rejection reason')}
          </Label>
          <Textarea
            id='note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isApprove ? t('Transaction ID or comment...') : t('Reason for rejection...')}
            rows={3}
          />
        </div>

        <DialogFooter className='gap-2'>
          <Button variant='outline' onClick={handleClose} disabled={loading}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={isApprove
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-destructive hover:bg-destructive/90 text-white'}
          >
            {loading
              ? t('Processing...')
              : isApprove
                ? t('Approve')
                : t('Reject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
