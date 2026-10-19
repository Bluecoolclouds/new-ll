import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { formatQuota } from '@/lib/format'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { WithdrawalRecord } from '@/features/wallet/api'
import { WithdrawalActionDialog } from './withdrawal-action-dialog'

function formatTime(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

function MethodBadge({ method }: { method: string }) {
  const label = method === 'sbp' ? 'СБП' : method === 'crypto' ? 'Крипто' : method
  const variant = method === 'sbp' ? 'info' : 'neutral'
  return <StatusBadge label={label} variant={variant} copyable={false} size='sm' />
}

function StatusCell({ status }: { status: string }) {
  const { t } = useTranslation()
  const map: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'neutral' }> = {
    pending: { label: t('Pending'), variant: 'warning' },
    approved: { label: t('Approved'), variant: 'success' },
    rejected: { label: t('Rejected'), variant: 'destructive' },
  }
  const s = map[status] ?? { label: status, variant: 'neutral' }
  return <StatusBadge label={s.label} variant={s.variant} copyable={false} />
}

function ActionsCell({
  row,
  onRefresh,
}: {
  row: WithdrawalRecord
  onRefresh: () => void
}) {
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  if (row.status !== 'pending') return <span className='text-muted-foreground text-xs'>—</span>

  return (
    <>
      <div className='flex items-center gap-1.5'>
        <Button
          size='sm'
          variant='outline'
          className='h-7 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
          onClick={() => setDialog('approve')}
        >
          <Check className='size-3.5' />
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='h-7 gap-1 border-red-400/30 text-red-500 hover:bg-red-50 hover:text-red-600'
          onClick={() => setDialog('reject')}
        >
          <X className='size-3.5' />
        </Button>
      </div>

      <WithdrawalActionDialog
        open={dialog !== null}
        action={dialog}
        record={row}
        onClose={() => setDialog(null)}
        onSuccess={() => { setDialog(null); onRefresh() }}
      />
    </>
  )
}

export function useWithdrawalsColumns(onRefresh: () => void): ColumnDef<WithdrawalRecord>[] {
  const { t } = useTranslation()

  return useMemo((): ColumnDef<WithdrawalRecord>[] => [
    {
      accessorKey: 'id',
      meta: { label: 'ID', mobileHidden: true },
      header: ({ column }) => <DataTableColumnHeader column={column} title='ID' />,
      cell: ({ row }) => <TableId value={row.original.id} />,
      size: 60,
    },
    {
      accessorKey: 'username',
      meta: { label: t('User'), mobileTitle: true },
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('User')} />,
      cell: ({ row }) => (
        <div>
          <div className='font-medium'>{row.original.username || `#${row.original.user_id}`}</div>
          <div className='text-muted-foreground text-xs'>ID {row.original.user_id}</div>
        </div>
      ),
      size: 140,
    },
    {
      accessorKey: 'amount',
      meta: { label: t('Amount') },
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('Amount')} />,
      cell: ({ row }) => (
        <span className='font-mono font-semibold text-emerald-600'>
          {formatQuota(row.original.amount)}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: 'method',
      meta: { label: t('Method') },
      header: t('Method'),
      cell: ({ row }) => <MethodBadge method={row.original.method} />,
      size: 90,
    },
    {
      accessorKey: 'details',
      meta: { label: t('Details'), mobileHidden: true },
      header: t('Details'),
      cell: ({ row }) => {
        const details = row.original.details
        if (!details) return <span className='text-muted-foreground text-xs'>—</span>
        return (
          <Popover>
            <PopoverTrigger asChild>
              <button className='text-muted-foreground hover:text-foreground max-w-[200px] truncate text-sm font-mono block text-left cursor-pointer underline-offset-2 hover:underline'>
                {details}
              </button>
            </PopoverTrigger>
            <PopoverContent className='max-w-sm break-all text-sm font-mono' align='start'>
              {details}
            </PopoverContent>
          </Popover>
        )
      },
      size: 200,
    },
    {
      accessorKey: 'status',
      meta: { label: t('Status'), mobileBadge: true },
      header: t('Status'),
      cell: ({ row }) => <StatusCell status={row.original.status} />,
      size: 110,
    },
    {
      accessorKey: 'note',
      meta: { label: t('Note'), mobileHidden: true },
      header: t('Note'),
      cell: ({ row }) => (
        <span className='text-muted-foreground max-w-[160px] truncate text-xs block'>
          {row.original.note || '—'}
        </span>
      ),
      size: 160,
    },
    {
      accessorKey: 'created_time',
      meta: { label: t('Date'), mobileHidden: true },
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('Date')} />,
      cell: ({ row }) => (
        <span className='text-muted-foreground text-xs'>{formatTime(row.original.created_time)}</span>
      ),
      size: 150,
    },
    {
      id: 'actions',
      meta: { label: t('Actions') },
      header: t('Actions'),
      cell: ({ row }) => <ActionsCell row={row.original} onRefresh={onRefresh} />,
      size: 100,
      enableSorting: false,
    },
  ], [t, onRefresh])
}
