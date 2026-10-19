import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { getUserLogs } from '@/features/usage-logs/api'
import { PanelWrapper } from '../ui/panel-wrapper'

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function RecentActivityPanel() {
  const { t } = useTranslation()

  const logsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'recent-activity'],
    queryFn: async () => {
      const result = await getUserLogs({ p: 1, page_size: 6 })
      return (result.data?.items ?? []) as Array<{
        id?: number
        model_name?: string
        quota: number
        created_at: number
        is_stream?: boolean
        channel?: number
      }>
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })

  const items = logsQuery.data ?? []

  return (
    <PanelWrapper
      title={t('Recent Activity')}
      loading={logsQuery.isLoading}
      empty={!logsQuery.isLoading && items.length === 0}
      emptyMessage={t('No recent requests')}
      height='h-40'
      contentClassName='p-0'
      headerActions={
        <Button
          variant='ghost'
          size='sm'
          className='h-7 px-2 text-xs'
          render={<Link to='/usage-logs' />}
        >
          {t('View all')}
        </Button>
      }
    >
      <div className='divide-y'>
        {items.map((log, i) => {
          const isSuccess = log.quota >= 0
          const StatusIcon = isSuccess ? CheckCircle2 : AlertCircle
          const modelShort =
            (log.model_name?.split('/').pop() ?? log.model_name ?? 'Unknown')
              .slice(0, 22)

          return (
            <div
              key={log.id ?? i}
              className='flex items-start gap-2.5 px-4 py-2.5 sm:px-5'
            >
              <StatusIcon
                className={`mt-0.5 size-3.5 shrink-0 ${isSuccess ? 'text-success' : 'text-destructive'}`}
              />
              <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <span
                  className='break-all text-xs font-medium leading-snug'
                  title={log.model_name}
                >
                  {modelShort}
                </span>
                <span className='text-muted-foreground flex items-center gap-1 text-[10px]'>
                  <Activity className='size-2.5' />
                  {formatQuota(log.quota)}
                </span>
              </span>
              <span className='text-muted-foreground mt-0.5 flex shrink-0 items-center gap-1 text-[10px]'>
                <Clock className='size-2.5' />
                {timeAgo(log.created_at)}
              </span>
            </div>
          )
        })}
      </div>
    </PanelWrapper>
  )
}
