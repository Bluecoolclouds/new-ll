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
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Flame,
  Star,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Turnstile } from '@/components/turnstile'
import { getCheckinStatus, performCheckin } from '../api'
import type { CheckinRecord } from '../types'

interface CheckinCalendarCardProps {
  checkinEnabled: boolean
  turnstileEnabled: boolean
  turnstileSiteKey: string
}

const MILESTONES = [7, 15, 25, 31] as const
const MILESTONE_MULTIPLIERS: Record<number, number> = {
  7: 3,
  15: 5,
  25: 7,
  31: 10,
}

function getNextMilestone(streak: number): number | null {
  return MILESTONES.find((m) => m > streak) ?? null
}

function getMilestoneMultiplier(streak: number): number | null {
  return MILESTONE_MULTIPLIERS[streak] ?? null
}

function isMilestone(streak: number): boolean {
  return streak in MILESTONE_MULTIPLIERS
}

export function CheckinCalendarCard({
  checkinEnabled,
  turnstileEnabled,
  turnstileSiteKey,
}: CheckinCalendarCardProps) {
  const { t } = useTranslation()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [turnstileModalVisible, setTurnstileModalVisible] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const [showTelegramPromo, setShowTelegramPromo] = useState(false)

  const currentMonthStr = useMemo(() => {
    const y = currentMonth.getFullYear()
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }, [currentMonth])

  /* eslint-disable @tanstack/query/exhaustive-deps */
  const {
    data: checkinData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['checkin-status', currentMonthStr],
    queryFn: async () => {
      const res = await getCheckinStatus(currentMonthStr)
      if (res.success && res.data) {
        return res.data
      }
      throw new Error(res.message || t('Failed to fetch checkin status'))
    },
    enabled: checkinEnabled,
    staleTime: 30000,
  })
  /* eslint-enable @tanstack/query/exhaustive-deps */

  const checkinRecordsMap = useMemo(() => {
    const map: Record<string, CheckinRecord> = {}
    const records = checkinData?.stats?.records || []
    records.forEach((record: CheckinRecord) => {
      map[record.checkin_date] = record
    })
    return map
  }, [checkinData?.stats?.records])

  const monthlyQuota = useMemo(() => {
    const records = checkinData?.stats?.records || []
    return records.reduce(
      (sum: number, record: CheckinRecord) => sum + (record.quota_awarded || 0),
      0
    )
  }, [checkinData?.stats?.records])

  const todayString = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const checkedToday = checkinData?.stats?.checked_in_today === true
  const todayRecord = checkinRecordsMap[todayString]
  const currentStreak = checkinData?.stats?.current_streak ?? 0
  const nextMilestone = getNextMilestone(currentStreak)
  const telegramChannelId = checkinData?.telegram_channel_id || ''
  const telegramChannelUrl = telegramChannelId
    ? `https://t.me/${telegramChannelId.replace(/^@/, '')}`
    : ''
  const nextMilestoneMultiplier = nextMilestone
    ? getMilestoneMultiplier(nextMilestone) ?? null
    : null

  useEffect(() => {
    if (initialLoaded) return
    if (isLoading) return
    if (!checkinData) return
    setCollapsed(checkedToday)
    setInitialLoaded(true)
  }, [checkinData, checkedToday, initialLoaded, isLoading])

  const shouldTriggerTurnstile = useCallback(
    (message?: string) => {
      if (!turnstileEnabled) return false
      if (typeof message !== 'string') return true
      return message.includes('Turnstile')
    },
    [turnstileEnabled]
  )

  const doCheckin = useCallback(
    async (token?: string) => {
      setCheckinLoading(true)
      try {
        const res = await performCheckin(token)
        if (res.success && res.data) {
          const { quota_awarded, streak, is_milestone } = res.data
          if (is_milestone) {
            toast.success(
              `🏆 ${t('Milestone')} ${streak} ${t('days')}! +${formatQuotaWithCurrency(quota_awarded)} (×${getMilestoneMultiplier(streak)})`,
              { duration: 5000 }
            )
          } else {
            toast.success(
              `🔥 ${t('Day')} ${streak} — +${formatQuotaWithCurrency(quota_awarded)}`
            )
          }
          if (telegramChannelId && streak === 1) {
            setShowTelegramPromo(true)
          }
          refetch()
          setTurnstileModalVisible(false)
        } else {
          if (!token && shouldTriggerTurnstile(res.message)) {
            if (!turnstileSiteKey) {
              toast.error(t('Turnstile is enabled but site key is empty.'))
              return
            }
            setTurnstileModalVisible(true)
            return
          }
          if (token && shouldTriggerTurnstile(res.message)) {
            setTurnstileWidgetKey((v) => v + 1)
          }
          toast.error(res.message || t('Check-in failed'))
        }
      } catch (_error) {
        toast.error(t('Check-in failed'))
      } finally {
        setCheckinLoading(false)
      }
    },
    [refetch, shouldTriggerTurnstile, t, turnstileSiteKey, telegramChannelUrl]
  )

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    )
  }

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    )
  }

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = []

    for (let i = 0; i < startDayOfWeek; i++) {
      const d = new Date(year, month, -startDayOfWeek + i + 1)
      days.push({ date: d, isCurrentMonth: false })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
      }
    }

    return days
  }, [currentMonth])

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  if (!checkinEnabled) {
    return null
  }

  if (isLoading) {
    return (
      <div className='bg-card overflow-hidden rounded-2xl border'>
        <div className='p-6'>
          <div className='flex items-start justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <Skeleton className='h-10 w-10 rounded-xl' />
              <div className='space-y-2'>
                <Skeleton className='h-5 w-32' />
                <Skeleton className='h-3 w-56' />
              </div>
            </div>
            <Skeleton className='h-9 w-28 rounded-md' />
          </div>
        </div>
      </div>
    )
  }

  // Milestone progress bar config
  const allMilestones = [0, ...MILESTONES]
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= currentStreak) ?? 0
  const progressMax = nextMilestone ?? 31
  const progressMin = prevMilestone
  const progressPct = nextMilestone
    ? Math.min(((currentStreak - progressMin) / (nextMilestone - progressMin)) * 100, 100)
    : 100

  return (
    <TooltipProvider delay={100}>
      <Dialog
        open={showTelegramPromo && !!telegramChannelUrl}
        onOpenChange={(open) => !open && setShowTelegramPromo(false)}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle className='text-center text-lg'>
              📢 {t('Subscribe to get daily rewards')}
            </DialogTitle>
          </DialogHeader>
          <div className='flex flex-col items-center gap-5 py-2'>
            <p className='text-muted-foreground text-center text-sm'>
              {t('Join our Telegram channel for news and bonuses')}
            </p>
            <a
              href={telegramChannelUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 py-2.5 text-sm font-semibold text-white hover:bg-sky-600'
            >
              {telegramChannelId}
              <ExternalLink className='h-4 w-4' />
            </a>
            <Button
              className='w-full'
              onClick={() => setShowTelegramPromo(false)}
            >
              {t('Done')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={turnstileModalVisible}
        onOpenChange={(open) => {
          setTurnstileModalVisible(open)
          if (!open) {
            setTurnstileWidgetKey((v) => v + 1)
          }
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Security Check')}</DialogTitle>
          </DialogHeader>
          <div className='text-muted-foreground text-sm'>
            {t('Please complete the security check to continue.')}
          </div>
          <div className='flex justify-center py-4'>
            <Turnstile
              key={turnstileWidgetKey}
              siteKey={turnstileSiteKey}
              onVerify={(token) => {
                doCheckin(token)
              }}
              onExpire={() => {
                setTurnstileWidgetKey((v) => v + 1)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className='bg-card overflow-hidden rounded-2xl border'>
        {/* Header */}
        <div className='border-b p-4 sm:p-5'>
          <div className='flex items-start justify-between gap-3'>
            <button
              type='button'
              className='flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left'
              onClick={() => setCollapsed((v) => !v)}
            >
              <div className='bg-primary/10 text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl'>
                <CalendarDays className='h-4 w-4' strokeWidth={2} />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <h3 className='text-sm font-semibold tracking-tight sm:text-base'>
                    {t('Daily Check-in')}
                  </h3>
                  {currentStreak > 0 && (
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
                        isMilestone(currentStreak)
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                      )}
                    >
                      {isMilestone(currentStreak) ? (
                        <Trophy className='h-2.5 w-2.5' />
                      ) : (
                        <Flame className='h-2.5 w-2.5' />
                      )}
                      {currentStreak} {t('days')}
                    </div>
                  )}
                  {checkedToday && (
                    <div className='inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400'>
                      <Sparkles className='h-2.5 w-2.5' />
                      {t('Checked in')}
                    </div>
                  )}
                </div>
                <p className='text-muted-foreground mt-0.5 text-xs'>
                  {checkedToday && todayRecord
                    ? `${t('Today')} +${formatQuotaWithCurrency(todayRecord.quota_awarded)}`
                    : nextMilestone
                      ? `${t('Next milestone')}: ${t('Day')} ${nextMilestone} (×${nextMilestoneMultiplier})`
                      : t('Check in daily to receive increasing quota rewards')}
                </p>
              </div>
            </button>
            <div className='flex shrink-0 items-center gap-2'>
              <Button
                onClick={() => doCheckin()}
                disabled={checkinLoading || checkedToday}
                size='sm'
                className='h-8 text-xs'
              >
                {checkinLoading
                  ? t('Loading...')
                  : checkedToday
                    ? t('Checked in')
                    : t('Check in now')}
              </Button>
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors'
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? (
                  <ChevronDown className='h-4 w-4' />
                ) : (
                  <ChevronUp className='h-4 w-4' />
                )}
              </button>
            </div>
          </div>
        </div>

        {!collapsed ? (
          <>
            {/* Stats */}
            <div className='grid grid-cols-3 divide-x border-b'>
              <div className='bg-card p-3 text-center sm:p-4'>
                <div className='text-lg font-semibold tracking-tight tabular-nums sm:text-xl'>
                  {checkinData?.stats?.total_checkins || 0}
                </div>
                <div className='text-muted-foreground mt-0.5 text-[11px] leading-tight sm:text-xs'>
                  {t('Total check-ins')}
                </div>
              </div>
              <div className='bg-card p-3 text-center sm:p-4'>
                <div className='text-lg font-semibold tracking-tight tabular-nums sm:text-xl'>
                  {formatQuotaWithCurrency(monthlyQuota, { digitsLarge: 0 })}
                </div>
                <div className='text-muted-foreground mt-0.5 text-[11px] leading-tight sm:text-xs'>
                  {t('This month')}
                </div>
              </div>
              <div className='bg-card p-3 text-center sm:p-4'>
                <div className='flex items-center justify-center gap-1'>
                  <span className='text-lg font-semibold tracking-tight tabular-nums sm:text-xl'>
                    {currentStreak}
                  </span>
                  {currentStreak > 0 && (
                    <Flame className='h-4 w-4 text-orange-500' />
                  )}
                </div>
                <div className='text-muted-foreground mt-0.5 text-[11px] leading-tight sm:text-xs'>
                  {t('Streak')}
                </div>
              </div>
            </div>

            {/* Milestone progress bar */}
            <div className='border-b px-4 py-3 sm:px-5'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-muted-foreground text-[11px] font-medium'>
                  {t('Streak progress')}
                </span>
                {nextMilestone ? (
                  <span className='text-[11px] font-medium text-amber-600 dark:text-amber-400'>
                    {t('Day')} {nextMilestone}: ×{nextMilestoneMultiplier}
                  </span>
                ) : (
                  <span className='text-[11px] font-medium text-amber-600 dark:text-amber-400'>
                    🏆 {t('Max milestone reached')}!
                  </span>
                )}
              </div>
              <div className='relative h-2 w-full overflow-hidden rounded-full bg-muted'>
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isMilestone(currentStreak)
                      ? 'bg-amber-500'
                      : 'bg-orange-400'
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className='relative mt-1.5 flex'>
                {MILESTONES.map((m) => {
                  const pct = ((m - progressMin) / (progressMax - progressMin)) * 100
                  const reached = currentStreak >= m
                  return (
                    <Tooltip key={m}>
                      <TooltipTrigger asChild>
                        <div
                          className='absolute -translate-x-1/2'
                          style={{ left: `${Math.min(pct, 100)}%` }}
                        >
                          <Star
                            className={cn(
                              'h-3 w-3 transition-colors',
                              reached
                                ? 'fill-amber-500 text-amber-500'
                                : 'text-muted-foreground/40'
                            )}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className='text-xs'>
                          <div className='font-medium'>
                            {t('Day')} {m}
                          </div>
                          <div className='text-muted-foreground'>
                            ×{MILESTONE_MULTIPLIERS[m]} {t('bonus')}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </div>

            {/* Calendar */}
            <div className='p-4 sm:p-5'>
              <div className='space-y-3'>
                {/* Month navigation */}
                <div className='flex items-center justify-between'>
                  <h4 className='text-xs font-semibold sm:text-sm'>
                    {dayjs(currentMonth).format('YYYY-MM')}
                  </h4>
                  <div className='flex items-center gap-0.5'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7 sm:h-8 sm:w-8'
                      onClick={handlePrevMonth}
                    >
                      <ChevronLeft className='h-3.5 w-3.5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7 sm:h-8 sm:w-8'
                      onClick={handleNextMonth}
                    >
                      <ChevronRight className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                </div>

                {/* Calendar grid */}
                <div className='grid grid-cols-7 gap-0.5'>
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className='text-muted-foreground flex h-7 items-center justify-center text-[10px] font-medium'
                    >
                      {day}
                    </div>
                  ))}

                  {calendarDays.map((dayObj, idx) => {
                    const dateStr = `${dayObj.date.getFullYear()}-${String(
                      dayObj.date.getMonth() + 1
                    ).padStart(2, '0')}-${String(
                      dayObj.date.getDate()
                    ).padStart(2, '0')}`
                    const isToday = dateStr === todayString
                    const record = checkinRecordsMap[dateStr]
                    const isCheckedIn = !!record
                    const isMilestoneDay = isCheckedIn && isMilestone(record.streak)
                    const dayNum = dayObj.date.getDate()

                    const dayButton = (
                      <Button
                        key={idx}
                        variant={isToday ? 'default' : 'ghost'}
                        disabled={!dayObj.isCurrentMonth}
                        className={cn(
                          'relative flex h-9 w-full flex-col items-center justify-center rounded-lg px-0 text-xs font-medium',
                          !dayObj.isCurrentMonth &&
                            'text-muted-foreground/40 cursor-default',
                          isToday && 'hover:bg-primary/90',
                          !isToday && isCheckedIn && 'font-semibold',
                          !isToday && isMilestoneDay && 'ring-1 ring-amber-400/60'
                        )}
                      >
                        <span className='tabular-nums'>{dayNum}</span>
                        {isCheckedIn && !isToday && (
                          <span
                            className={cn(
                              'absolute bottom-0.5 h-1 w-1 rounded-full sm:bottom-1',
                              isMilestoneDay ? 'bg-amber-500' : 'bg-emerald-500'
                            )}
                          />
                        )}
                      </Button>
                    )

                    if (isCheckedIn && dayObj.isCurrentMonth) {
                      return (
                        <Tooltip key={idx}>
                          <TooltipTrigger render={dayButton} />
                          <TooltipContent>
                            <div className='text-xs'>
                              <div className='font-medium flex items-center gap-1'>
                                {isMilestoneDay && (
                                  <Trophy className='h-3 w-3 text-amber-500' />
                                )}
                                {isMilestoneDay
                                  ? `${t('Milestone')} ${record.streak} ${t('days')}!`
                                  : t('Checked in')}
                              </div>
                              <div className='text-muted-foreground mt-0.5'>
                                +{formatQuotaWithCurrency(record.quota_awarded)}
                                {record.streak > 0 && (
                                  <span className='ml-1'>
                                    ({t('Day')} {record.streak})
                                  </span>
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return dayButton
                  })}
                </div>

                {/* Info block */}
                <div className='bg-muted/40 rounded-xl p-3'>
                  <ul className='text-muted-foreground space-y-1.5 text-[11px] sm:text-xs'>
                    <li className='flex items-start gap-2'>
                      <Flame className='text-orange-500 mt-0.5 h-3 w-3 shrink-0' />
                      <span>{t('Each consecutive day adds +5% to your reward')}</span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <Trophy className='text-amber-500 mt-0.5 h-3 w-3 shrink-0' />
                      <span>
                        {t('Super bonuses on days')} 7 (×3), 15 (×5), 25 (×7), 31 (×10)
                      </span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <span className='text-primary mt-0.5 shrink-0'>•</span>
                      <span>{t('You can only check in once per day')}</span>
                    </li>
                    {telegramChannelUrl && (
                      <li className='flex items-start gap-2'>
                        <span className='mt-0.5 shrink-0 text-sky-500'>•</span>
                        <span className='flex flex-wrap items-center gap-1'>
                          {t('Subscribe for news and bonuses')}:{' '}
                          <a
                            href={telegramChannelUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center gap-0.5 text-sky-500 underline underline-offset-2'
                          >
                            {telegramChannelId}
                            <ExternalLink className='h-2.5 w-2.5' />
                          </a>
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
