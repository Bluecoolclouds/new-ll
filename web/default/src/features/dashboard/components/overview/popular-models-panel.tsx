import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Cpu } from 'lucide-react'
import { formatQuota } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { PanelWrapper } from '../ui/panel-wrapper'

interface ModelSummary {
  name: string
  totalQuota: number
  requestCount: number
}

function deriveTopModels(data: QuotaDataItem[], limit = 5): ModelSummary[] {
  const map = new Map<string, ModelSummary>()
  for (const item of data) {
    if (!item.model_name) continue
    const existing = map.get(item.model_name)
    if (existing) {
      existing.totalQuota += item.quota ?? 0
      existing.requestCount += item.count ?? 0
    } else {
      map.set(item.model_name, {
        name: item.model_name,
        totalQuota: item.quota ?? 0,
        requestCount: item.count ?? 0,
      })
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.totalQuota - a.totalQuota)
    .slice(0, limit)
}

interface PopularModelsPanelProps {
  data: QuotaDataItem[]
  loading?: boolean
}

function ModelChip({ model }: { model: ModelSummary }) {
  const shortName = model.name.split('/').pop() ?? model.name
  return (
    <div className='bg-muted/40 hover:bg-muted/70 flex min-w-36 flex-col gap-2 rounded-xl border px-3 py-2.5 transition-colors'>
      <div className='flex items-center gap-2'>
        <span className='bg-background flex size-7 shrink-0 items-center justify-center rounded-lg border shadow-xs'>
          <Cpu className='size-3.5' />
        </span>
        <span
          className='max-w-28 truncate text-xs font-medium'
          title={model.name}
        >
          {shortName}
        </span>
      </div>
      <div className='flex flex-wrap gap-1'>
        <Badge variant='outline' className='px-1.5 py-0 text-[10px]'>
          {formatQuota(model.totalQuota)}
        </Badge>
        {model.requestCount > 0 && (
          <Badge variant='secondary' className='px-1.5 py-0 text-[10px]'>
            {model.requestCount} req
          </Badge>
        )}
      </div>
    </div>
  )
}

export function PopularModelsPanel({
  data,
  loading,
}: PopularModelsPanelProps) {
  const topModels = useMemo(() => deriveTopModels(data), [data])

  return (
    <PanelWrapper
      title='Popular Models'
      loading={loading}
      empty={!loading && topModels.length === 0}
      emptyMessage='No model usage in the selected period'
      height='h-24'
      contentClassName='p-0 py-0'
      headerActions={
        <Button variant='ghost' size='sm' className='h-7 px-2 text-xs' render={<Link to='/pricing' />}>
          View all
        </Button>
      }
    >
      <ScrollArea>
        <div className='flex gap-2 px-4 py-3 sm:px-5'>
          {topModels.map((model) => (
            <ModelChip key={model.name} model={model} />
          ))}
        </div>
        <ScrollBar orientation='horizontal' />
      </ScrollArea>
    </PanelWrapper>
  )
}
