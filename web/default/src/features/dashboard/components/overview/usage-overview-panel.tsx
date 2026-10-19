import { useEffect, useMemo, useRef, useState } from 'react'
import { VChart } from '@visactor/react-vchart'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { formatChartTime } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { PanelWrapper } from '../ui/panel-wrapper'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

interface UsageOverviewPanelProps {
  data: QuotaDataItem[]
  loading?: boolean
}

function getChartColor(): string {
  if (typeof document === 'undefined') return '#f97316'
  const body = window.getComputedStyle(document.body)
  const root = window.getComputedStyle(document.documentElement)
  const raw = (body.getPropertyValue('--chart-1') || root.getPropertyValue('--chart-1')).trim()
  return raw || '#f97316'
}

export function UsageOverviewPanel({ data, loading }: UsageOverviewPanelProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(m => m.ThemeManager)
      }
      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    updateTheme()
  }, [resolvedTheme])

  const { totalSpend, totalRequests, chartValues, chartColor } = useMemo(() => {
    let spend = 0
    let requests = 0
    const timeMap = new Map<string, { quota: number; count: number }>()

    for (const item of data) {
      spend += item.quota ?? 0
      requests += item.count ?? 0
      const key = formatChartTime(item.created_at, 'day')
      const prev = timeMap.get(key) ?? { quota: 0, count: 0 }
      timeMap.set(key, {
        quota: prev.quota + (item.quota ?? 0),
        count: prev.count + (item.count ?? 0),
      })
    }

    const values = Array.from(timeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, v]) => ({ time, quota: v.quota, count: v.count }))

    return {
      totalSpend: spend,
      totalRequests: requests,
      chartValues: values,
      chartColor: getChartColor(),
    }
  }, [data, resolvedTheme, customization.preset])

  const spec = useMemo(() => ({
    type: 'area',
    data: [{ id: 'usageData', values: chartValues }],
    xField: 'time',
    yField: 'quota',
    smooth: true,
    area: {
      style: { fillOpacity: 0.12 },
    },
    line: {
      style: { lineWidth: 2, stroke: chartColor },
    },
    point: { visible: false },
    color: [chartColor],
    padding: { top: 16, right: 16, bottom: 8, left: 8 },
    axes: [
      {
        orient: 'left',
        label: {
          formatMethod: (value: number) => formatQuota(value),
          style: { fontSize: 11 },
        },
        grid: {
          style: { lineDash: [4, 4], stroke: 'rgba(128,128,128,0.15)' },
        },
        domainLine: { visible: false },
        tick: { visible: false },
      },
      {
        orient: 'bottom',
        label: { style: { fontSize: 11 } },
        domainLine: { visible: false },
        tick: { visible: false },
      },
    ],
    crosshair: {
      xField: {
        visible: true,
        line: { style: { lineDash: [4, 4], lineWidth: 1 } },
      },
    },
    tooltip: {
      mark: {
        content: [
          {
            key: t('Spend'),
            value: (datum: Record<string, unknown>) =>
              formatQuota(Number(datum.quota) || 0),
          },
          {
            key: t('Requests'),
            value: (datum: Record<string, unknown>) =>
              String(datum.count ?? 0),
          },
        ],
      },
    },
    background: 'transparent',
  }), [chartValues, chartColor, t])

  const chartKey = [
    loading ? 'loading' : 'ready',
    chartValues.length,
    resolvedTheme,
    customization.preset,
  ].join('-')

  return (
    <PanelWrapper
      title={t('Usage Overview')}
      description={t('Spend & requests — last 7 days')}
      contentClassName='p-0'
    >
      {/* Chart */}
      <div className='h-64 sm:h-72'>
        {loading ? (
          <div className='p-4 sm:p-5'>
            <Skeleton className='h-full w-full rounded-xl' />
          </div>
        ) : !themeReady || chartValues.length === 0 ? (
          <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
            {t('No data available')}
          </div>
        ) : (
          <VChart
            key={chartKey}
            spec={{
              ...spec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        )}
      </div>
    </PanelWrapper>
  )
}
