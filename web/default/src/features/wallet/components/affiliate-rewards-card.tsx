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
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  onWithdraw: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onTransfer,
  onWithdraw,
  complianceConfirmed = true,
  loading,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card className='overflow-hidden py-0'>
        <Skeleton className='h-28 w-full rounded-none' />
        <CardContent className='flex flex-col gap-4 p-4 sm:p-5'>
          <div className='flex justify-around gap-2'>
            <div className='flex flex-col items-center gap-1'>
              <Skeleton className='h-7 w-20' />
              <Skeleton className='h-3 w-16' />
            </div>
            <div className='flex flex-col items-center gap-1'>
              <Skeleton className='h-7 w-20' />
              <Skeleton className='h-3 w-16' />
            </div>
            <div className='flex flex-col items-center gap-1'>
              <Skeleton className='h-7 w-12' />
              <Skeleton className='h-3 w-16' />
            </div>
          </div>
          <div className='flex gap-2'>
            <Skeleton className='h-9 flex-1 rounded-lg' />
            <Skeleton className='h-9 flex-1 rounded-lg' />
          </div>
          <Skeleton className='h-9 rounded-lg' />
          <div className='flex flex-col gap-2'>
            <Skeleton className='h-4 w-16' />
            <Skeleton className='h-3 w-full' />
            <Skeleton className='h-3 w-4/5' />
            <Skeleton className='h-3 w-3/4' />
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0

  const stats = [
    {
      label: t('Pending Revenue'),
      value: formatQuota(user?.aff_quota ?? 0),
    },
    {
      label: t('Total Revenue'),
      value: formatQuota(user?.aff_history_quota ?? 0),
    },
    {
      label: t('Reward Times'),
      value: String(user?.aff_count ?? 0),
    },
  ]

  const rules = [
    t(
      'Earn 10% from direct referrals, 5% from level 2, and 3% from level 3 — on every top-up they make.'
    ),
    t(
      'Rewards accumulate as Pending Revenue and can be transferred to your main balance at any time.'
    ),
    t(
      'There is no limit on the number of referrals or the total rewards you can earn.'
    ),
  ]

  return (
    <Card className='overflow-hidden py-0'>
      {/* Cover banner */}
      <div className='relative h-28 w-full overflow-hidden'>
        <img
          src='/auth-bg.jpg'
          alt=''
          className='h-full w-full object-cover'
          aria-hidden='true'
        />
        <div className='absolute inset-0 bg-gradient-to-b from-black/20 to-black/60' />
        <div className='absolute inset-0 flex flex-col justify-end p-4'>
          <h3 className='text-base font-semibold text-white drop-shadow'>
            {t('Referral Program')}
          </h3>
          <p className='text-xs text-white/80 drop-shadow'>
            {t(
              'Earn rewards when your referrals add funds. Transfer accumulated rewards to your balance anytime.'
            )}
          </p>
        </div>
      </div>

      <CardContent className='flex flex-col gap-4 p-4 sm:p-5'>
        {/* Stats row */}
        <div className='flex justify-around gap-2 text-center'>
          {stats.map(({ label, value }) => (
            <div key={label} className='flex min-w-0 flex-1 flex-col items-center'>
              <span className='text-2xl font-bold tabular-nums leading-tight'>
                {value}
              </span>
              <span className='text-muted-foreground mt-0.5 text-[11px] font-medium'>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className='flex gap-2'>
          <Button
            onClick={onTransfer}
            disabled={!hasRewards || !complianceConfirmed}
            className='h-9 flex-1'
            size='sm'
          >
            {t('Transfer to Balance')}
          </Button>
          <Button
            variant='outline'
            className='h-9 flex-1'
            size='sm'
            disabled={!hasRewards}
            onClick={onWithdraw}
          >
            {t('Withdraw')}
          </Button>
        </div>

        {!complianceConfirmed && (
          <p className='text-muted-foreground -mt-2 text-xs'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        )}

        {/* Invite link */}
        <div className='flex flex-col gap-1.5'>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('Your Referral Link')}
          </span>
          <div className='flex items-center gap-2'>
            <Input
              value={affiliateLink}
              readOnly
              className='border-muted bg-muted/30 h-9 min-w-0 flex-1 font-mono text-xs'
            />
            <CopyButton
              value={affiliateLink}
              variant='outline'
              className='size-9 shrink-0'
              iconClassName='size-4'
              tooltip={t('Copy referral link')}
              aria-label={t('Copy referral link')}
            />
          </div>
        </div>

        {/* Rules section */}
        <div className='border-muted rounded-lg border p-3'>
          <p className='mb-2 text-xs font-semibold'>{t('Rules')}</p>
          <ul className='text-muted-foreground flex flex-col gap-1.5 text-xs'>
            {rules.map((rule) => (
              <li key={rule} className='flex gap-2'>
                <span className='text-primary mt-px shrink-0'>•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
