import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { DataTablePage } from '@/components/data-table'
import { adminGetWithdrawals } from '@/features/wallet/api'
import { useWithdrawalsColumns } from './withdrawals-columns'

export function WithdrawalsTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: true }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] })
  }, [queryClient])

  const columns = useWithdrawalsColumns(refresh)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: async () => {
      const result = await adminGetWithdrawals({ page: 1, pageSize: 100 })
      return result.data || []
    },
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  })

  const records = data || []

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      emptyTitle={t('No withdrawal requests')}
      emptyDescription={t('Withdrawal requests from users will appear here')}
      skeletonKeyPrefix='withdrawals-skeleton'
    />
  )
}
