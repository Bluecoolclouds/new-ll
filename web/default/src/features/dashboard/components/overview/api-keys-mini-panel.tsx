import { Link } from '@tanstack/react-router'
import { Check, Copy, ExternalLink, KeyRound, MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrencyUSD, formatQuota } from '@/lib/format'
import { getCurrencyDisplay } from '@/lib/currency'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ApiKey } from '@/features/keys/types'
import { PanelWrapper } from '../ui/panel-wrapper'

function formatKeyExcerpt(key?: string): string {
  if (!key) return 'sk-...'
  if (key.length <= 14) return key
  return `${key.slice(0, 7)}...${key.slice(-4)}`
}

function formatBudget(key: ApiKey): { remaining: string; total: string } {
  if (key.unlimited_quota) return { remaining: '∞', total: '∞' }
  const total = (key.remain_quota ?? 0) + (key.used_quota ?? 0)
  return {
    remaining: formatQuota(key.remain_quota ?? 0),
    total: formatQuota(total),
  }
}

function gatewayBudgetLabel(key: ApiKey, t: (key: string, options?: Record<string, unknown>) => string): { label: string; warning: boolean } | null {
  if (!key.gateway_enabled) return null
  const daily = key.gateway_daily_limit ?? 0
  const used = key.gateway_daily_used ?? 0
  const monthly = key.gateway_monthly_limit ?? 0
  const monthlyUsed = key.gateway_monthly_used ?? 0
  const { config } = getCurrencyDisplay()
  const threshold = key.gateway_warning_percent ?? 80
  return {
    label: daily > 0
      ? t('{{remaining}} daily left', { remaining: formatCurrencyUSD(Math.max(0, daily - used) / config.quotaPerUnit) })
      : t('Unlimited daily'),
    warning:
      (daily > 0 && used / daily * 100 >= threshold) ||
      (monthly > 0 && monthlyUsed / monthly * 100 >= threshold),
  }
}

function StatusDot({ status }: { status: number }) {
  if (status === 1) {
    return <span className='bg-success size-1.5 rounded-full shrink-0' />
  }
  return <span className='bg-destructive size-1.5 rounded-full shrink-0' />
}

function CopyKeyButton({ apiKey }: { apiKey: ApiKey }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!apiKey.key) return
    await copyToClipboard(apiKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className='group/key flex items-center gap-1 rounded px-1 -mx-1 transition-colors hover:bg-muted/60 cursor-pointer'
      title='Копировать ключ'
    >
      <span className='text-muted-foreground font-mono text-[11px] transition-colors group-hover/key:text-foreground'>
        {formatKeyExcerpt(apiKey.key)}
      </span>
      <span className='text-muted-foreground/50 group-hover/key:text-muted-foreground shrink-0 transition-colors'>
        {copied
          ? <Check className='size-2.5 text-success' />
          : <Copy className='size-2.5' />
        }
      </span>
    </button>
  )
}

function KeyRowMenu({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()

  const handleCopyKey = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (apiKey.key) await copyToClipboard(apiKey.key)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          variant='ghost'
          size='icon'
          className='size-7 shrink-0 rounded-lg'
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        />
      }>
        <MoreHorizontal className='size-3.5' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-40'>
        <DropdownMenuItem onClick={handleCopyKey}>
          <Copy className='size-3.5' />
          {t('Copy key')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to='/keys' />}>
          <ExternalLink className='size-3.5' />
          {t('All keys')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ApiKeysMiniPanelProps {
  keys: ApiKey[]
  loading?: boolean
}

export function ApiKeysMiniPanel({ keys, loading }: ApiKeysMiniPanelProps) {
  const { t } = useTranslation()
  const displayKeys = keys.slice(0, 5)

  return (
    <PanelWrapper
      title={t('Your API Keys')}
      loading={loading}
      empty={!loading && keys.length === 0}
      emptyMessage={t('No API keys yet')}
      contentClassName='p-0'
      headerActions={
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 px-2 text-xs'
            render={<Link to='/keys' />}
          >
            {t('View all')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='h-7 gap-1 px-2 text-xs'
            render={<Link to='/keys' />}
          >
            <Plus className='size-3' />
            {t('New')}
          </Button>
        </div>
      }
    >
      {/* Column headers */}
      <div className='text-muted-foreground/70 border-b px-4 pb-1.5 pt-2 sm:px-5'>
        <div className='grid items-center gap-3 text-[10px] font-medium uppercase tracking-wider'
          style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,7rem) minmax(0,10rem) auto' }}
        >
          <span>{t('Name')}</span>
          <span className='text-center'>{t('Budget')}</span>
          <span>{t('Key')}</span>
          <span />
        </div>
      </div>

      <div className='divide-y'>
        {displayKeys.map((key) => {
          const budget = formatBudget(key)
          const gatewayBudget = gatewayBudgetLabel(key, t)
          return (
            <Link
              key={key.id}
              to='/keys'
              className='hover:bg-muted/30 flex items-center gap-3 px-4 py-2.5 transition-colors sm:px-5'
            >
              <div
                className='grid w-full items-center gap-3'
                style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,7rem) minmax(0,10rem) auto' }}
              >
                {/* Name */}
                <span className='flex min-w-0 items-center gap-2'>
                  <span className='bg-muted flex size-6 shrink-0 items-center justify-center rounded-md'>
                    <KeyRound className='size-3' />
                  </span>
                  <span className='flex min-w-0 items-center gap-1.5'>
                    <StatusDot status={key.status ?? 0} />
                    <span className='truncate text-xs font-medium'>
                      {key.name || t('Unnamed key')}
                    </span>
                    {key.group && (
                      <Badge
                        variant='secondary'
                        className='hidden lg:inline-flex shrink-0 px-1.5 py-0 text-[10px]'
                      >
                        {key.group}
                      </Badge>
                    )}
                  </span>
                </span>

                {/* Budget (center) */}
                <span className='flex min-w-0 flex-col items-center gap-0'>
                  <span className='text-sm font-semibold tabular-nums'>
                    {budget.remaining}
                  </span>
                  {!key.unlimited_quota && (
                    <span className='text-muted-foreground text-[11px] tabular-nums'>
                      / {budget.total}
                    </span>
                  )}
                    {gatewayBudget && (
                      <span className={`text-[10px] tabular-nums ${gatewayBudget.warning ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                        {gatewayBudget.label}
                        {gatewayBudget.warning && ` · ${t('Warning')}`}
                      </span>
                    )}
                </span>

                {/* Key (click to copy) */}
                <span onClick={(e) => e.preventDefault()}>
                  <CopyKeyButton apiKey={key} />
                </span>

                {/* Menu */}
                <span onClick={(e) => e.preventDefault()}>
                  <KeyRowMenu apiKey={key} />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </PanelWrapper>
  )
}
