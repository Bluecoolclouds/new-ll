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
import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import type { UserWalletData } from '../types'

const VIP_THRESHOLD = 1000
const SVIP_DAILY = 100

interface VipTierCardProps {
  user: UserWalletData | null
  quotaPerUnit: number
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className='h-1.5 w-full overflow-hidden rounded-full bg-white/10'>
      <div
        className='h-full rounded-full bg-gradient-to-r from-indigo-400 to-amber-300 transition-all duration-700'
        style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
      />
    </div>
  )
}

export function VipTierCard({ user, quotaPerUnit }: VipTierCardProps) {
  const { t } = useTranslation()

  const qpu = quotaPerUnit > 0 ? quotaPerUnit : 500000
  const usedUSD = (user?.used_quota ?? 0) / qpu
  const todayUSD = (user?.today_quota ?? 0) / qpu

  const vipPct = Math.min((usedUSD / VIP_THRESHOLD) * 100, 100)
  const svipPct = Math.min((todayUSD / SVIP_DAILY) * 100, 100)

  const fmtUSD = (v: number) =>
    v >= 1000
      ? `$${(v / 1000).toFixed(1)}k`
      : `$${v.toFixed(v < 10 ? 2 : 0)}`

  const perks = [
    t('Reach $1,000 in total spend to auto-upgrade to the VIP group.'),
    t('Spend $100 in a single day as VIP to instantly upgrade to SVIP. SVIP is kept as long as you spend ≥ $100 every day.'),
    t('Higher tiers unlock extra discounts stacked on top of current offers.'),
  ]

  return (
    <Card className='relative isolate overflow-hidden border-0 bg-gradient-to-tr from-zinc-900 to-zinc-700 py-0 text-white'>
      <div className='absolute -top-10 -left-24 -z-10 size-40 rotate-45 rounded-lg bg-gradient-to-r from-transparent to-indigo-500/30' />

      <div className='flex items-start gap-4 p-4 sm:p-5'>
        <div className='min-w-0 flex-1'>
          <h3 className='mb-2 flex items-center gap-2 text-lg font-semibold'>
            <Crown className='size-5 shrink-0 text-amber-300' />
            {t('VIP Rewards')}
          </h3>

          <ul className='mb-3 flex flex-col gap-1.5 text-[13px] text-white/80'>
            {perks.map((perk) => (
              <li key={perk} className='flex gap-2'>
                <span className='mt-px shrink-0 text-indigo-300'>•</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          <div className='flex flex-col gap-2.5 rounded-lg bg-white/5 px-3 py-2.5'>
            <div>
              <div className='mb-1 flex items-baseline justify-between text-[12px]'>
                <span className='text-white/60'>{t('Total spend')} → VIP</span>
                <span className='font-mono text-white/90'>
                  {fmtUSD(usedUSD)}{' '}
                  <span className='text-white/40'>/ {fmtUSD(VIP_THRESHOLD)}</span>
                </span>
              </div>
              <ProgressBar pct={vipPct} />
            </div>

            <div>
              <div className='mb-1 flex items-baseline justify-between text-[12px]'>
                <span className='text-white/60'>{t('Today\'s spend')} → SVIP</span>
                <span className='font-mono text-white/90'>
                  {fmtUSD(todayUSD)}{' '}
                  <span className='text-white/40'>/ {fmtUSD(SVIP_DAILY)}</span>
                </span>
              </div>
              <ProgressBar pct={svipPct} />
            </div>
          </div>
        </div>

        <Crown
          className='mt-1 size-16 shrink-0 text-amber-300/15'
          aria-hidden='true'
        />
      </div>
    </Card>
  )
}
