import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AnimateInView } from '@/components/animate-in-view'

interface Model {
  name: string
  label: string
  provider: string
  inputApinet: number
  outputApinet: number
  inputRetail: number
  outputRetail: number
  note?: string
}

const MODELS: Model[] = [
  {
    name: 'Gemini 3 Flash',
    label: 'gemini-3-flash',
    provider: 'Google',
    inputApinet: 0.5,
    outputApinet: 3.0,
    inputRetail: 1.25,
    outputRetail: 7.0,
  },
  {
    name: 'GPT-5.5',
    label: 'gpt-5.5',
    provider: 'OpenAI',
    inputApinet: 0.4,
    outputApinet: 0.8,
    inputRetail: 2.0,
    outputRetail: 8.0,
  },
  {
    name: 'GPT-5.4',
    label: 'gpt-5.4',
    provider: 'OpenAI',
    inputApinet: 0.12,
    outputApinet: 0.24,
    inputRetail: 0.6,
    outputRetail: 1.2,
  },
  {
    name: 'Grok-4 Fast',
    label: 'grok-4-fast',
    provider: 'xAI',
    inputApinet: 12.5,
    outputApinet: 12.5,
    inputRetail: 25.0,
    outputRetail: 25.0,
    note: '~$0.025/req',
  },
  {
    name: 'DeepSeek V4 Pro',
    label: 'deepseek-v4-pro',
    provider: 'DeepSeek',
    inputApinet: 3.0,
    outputApinet: 6.0,
    inputRetail: 8.0,
    outputRetail: 16.0,
  },
  {
    name: 'DeepSeek V3.2',
    label: 'deepseek-v3.2',
    provider: 'DeepSeek',
    inputApinet: 2.0,
    outputApinet: 3.0,
    inputRetail: 4.0,
    outputRetail: 6.0,
  },
]

const VOLUMES = [
  { label: '1M', value: 1, desc: 'тест' },
  { label: '10M', value: 10, desc: 'стартап' },
  { label: '100M', value: 100, desc: 'прод' },
  { label: '1B', value: 1000, desc: 'энтерпрайз' },
]

const PROVIDER_DOT: Record<string, string> = {
  Google:   'bg-blue-400',
  OpenAI:   'bg-emerald-400',
  xAI:      'bg-purple-400',
  DeepSeek: 'bg-cyan-400',
}

// 300 RUB top-up → $10 credit bonus
// at ~75 RUB/$: 300 RUB ≈ $4 paid → get $10 → bonus multiplier = 10/4 = 2.5×
const BONUS_MULTIPLIER = 2.5

export function Calculator() {
  const { t } = useTranslation()
  const [selectedModel, setSelectedModel] = useState(0)
  const [selectedVolume, setSelectedVolume] = useState(1)
  const [bonusEnabled, setBonusEnabled] = useState(true)

  const model  = MODELS[selectedModel]
  const volume = VOLUMES[selectedVolume].value

  const blendedApinet = (model.inputApinet + model.outputApinet) / 2
  const blendedRetail = (model.inputRetail  + model.outputRetail)  / 2

  const effectiveApinet = bonusEnabled ? blendedApinet / BONUS_MULTIPLIER : blendedApinet

  const apinetCost  = effectiveApinet * volume
  const retailCost  = blendedRetail   * volume
  const saved       = retailCost - apinetCost
  const discount    = retailCost > 0 ? Math.round((saved / retailCost) * 100) : 0

  const fmt = (n: number) =>
    n >= 1000
      ? `$${(n / 1000).toFixed(1)}K`
      : n >= 1
        ? `$${n.toFixed(2)}`
        : `$${n.toFixed(3)}`

  return (
    <section className='border-border/40 relative z-10 overflow-hidden border-t px-6 py-24 md:py-32'>
      {/* Subtle light gradient mesh */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-30 dark:opacity-[0.08]'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 15% 70%, oklch(0.72 0.12 250 / 60%) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 40% at 85% 25%, oklch(0.68 0.10 200 / 50%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Calculator')}
          </p>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('How much will you save')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-3 max-w-md text-sm'>
            {t('Compare APINET prices with direct provider rates')}
          </p>
        </AnimateInView>

        {/* Bonus banner */}
        <AnimateInView delay={50}>
          <button
            onClick={() => setBonusEnabled(!bonusEnabled)}
            className={`group mx-auto mb-8 flex w-fit items-center gap-3 rounded-2xl border px-5 py-3 transition-all duration-200 ${
              bonusEnabled
                ? 'border-amber-400/40 bg-amber-400/8 shadow-sm shadow-amber-400/10'
                : 'border-border/40 bg-muted/10 opacity-60'
            }`}
          >
            <Sparkles className={`size-4 shrink-0 transition-colors ${bonusEnabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <div className='text-left'>
              <span className={`text-xs font-semibold ${bonusEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                {t('Top-up bonus: 300₽ → $10 credit')}
              </span>
              <span className='text-muted-foreground ml-2 text-xs'>
                {bonusEnabled
                  ? t('(effective 2.5× cheaper — click to disable)')
                  : t('(click to enable)')}
              </span>
            </div>
            <div className={`ml-auto flex size-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
              bonusEnabled
                ? 'border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-400'
                : 'border-border/40 bg-muted/20 text-muted-foreground'
            }`}>
              2.5×
            </div>
          </button>
        </AnimateInView>

        <AnimateInView animation='fade-up' delay={100}>
          <div className='border-border/40 bg-background overflow-hidden rounded-2xl border shadow-xl shadow-black/5'>
            <div className='grid gap-0 lg:grid-cols-2'>

              {/* ── Left: controls ── */}
              <div className='border-border/30 space-y-7 p-8 lg:border-r'>

                {/* Model selector */}
                <div>
                  <label className='text-muted-foreground mb-3 block text-[10px] font-bold tracking-[0.15em] uppercase'>
                    {t('Model')}
                  </label>
                  <div className='grid grid-cols-2 gap-2'>
                    {MODELS.map((m, i) => (
                      <button
                        key={m.label}
                        onClick={() => setSelectedModel(i)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-all duration-150 ${
                          selectedModel === i
                            ? 'border-blue-500/40 bg-blue-500/8 ring-1 ring-blue-500/20'
                            : 'border-border/40 bg-muted/20 hover:border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className='flex items-center gap-1.5'>
                          <span className={`size-1.5 shrink-0 rounded-full ${PROVIDER_DOT[m.provider] ?? 'bg-muted-foreground'}`} />
                          <span className='font-semibold text-foreground/90'>{m.name}</span>
                        </div>
                        <div className='text-muted-foreground/60 mt-1 font-mono text-[10px]'>
                          {m.note ? m.note : `in $${m.inputApinet} · out $${m.outputApinet}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume selector */}
                <div>
                  <label className='text-muted-foreground mb-3 block text-[10px] font-bold tracking-[0.15em] uppercase'>
                    {t('Tokens per month')}
                  </label>
                  <div className='grid grid-cols-4 gap-2'>
                    {VOLUMES.map((v, i) => (
                      <button
                        key={v.label}
                        onClick={() => setSelectedVolume(i)}
                        className={`rounded-xl border px-2 py-2.5 text-center text-xs transition-all duration-150 ${
                          selectedVolume === i
                            ? 'border-blue-500/40 bg-blue-500/8 ring-1 ring-blue-500/20'
                            : 'border-border/40 bg-muted/20 hover:border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className='font-semibold'>{v.label}</div>
                        <div className='text-muted-foreground/60 mt-0.5 text-[10px]'>{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rate info */}
                <div className='border-border/30 bg-muted/10 space-y-2.5 rounded-xl border p-4'>
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-muted-foreground'>{t('APINET rate')} (in/out)</span>
                    <span className='font-mono font-semibold text-blue-600 dark:text-blue-400'>
                      ${model.inputApinet} / ${model.outputApinet} /1M
                    </span>
                  </div>
                  {bonusEnabled && (
                    <div className='flex items-center justify-between text-xs'>
                      <span className='text-muted-foreground'>{t('With bonus 2.5×')}</span>
                      <span className='font-mono font-semibold text-emerald-600 dark:text-emerald-400'>
                        ${(model.inputApinet / BONUS_MULTIPLIER).toFixed(3)} / ${(model.outputApinet / BONUS_MULTIPLIER).toFixed(3)} /1M
                      </span>
                    </div>
                  )}
                  <div className='bg-border/40 h-px' />
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-muted-foreground'>{t('Retail rate')} (in/out)</span>
                    <span className='text-muted-foreground font-mono line-through'>
                      ${model.inputRetail} / ${model.outputRetail} /1M
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Right: result ── */}
              <div className='flex flex-col justify-center p-8 text-center'>

                {/* Savings % */}
                <div className='mb-8'>
                  {discount > 0 ? (
                    <>
                      <div className='bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent tabular-nums md:text-6xl'>
                        -{discount}%
                      </div>
                      <div className='text-muted-foreground mt-2 text-sm'>
                        {t('savings vs direct')}
                        {bonusEnabled && (
                          <span className='ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400'>
                            <Sparkles className='size-2.5' />
                            {t('with bonus')}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className='text-muted-foreground text-4xl font-bold'>≈</div>
                      <div className='text-muted-foreground mt-2 text-sm'>{t('similar price')}</div>
                    </>
                  )}
                </div>

                {/* Cost breakdown */}
                <div className='border-border/30 bg-muted/10 mb-8 space-y-4 rounded-xl border p-5'>
                  <div>
                    <div className='text-muted-foreground mb-1 text-xs'>{t('You pay with APINET')}</div>
                    <div className='text-2xl font-bold tabular-nums'>
                      {fmt(apinetCost)}
                      <span className='text-muted-foreground ml-1 text-sm font-normal'>/{t('month')}</span>
                    </div>
                    {bonusEnabled && (
                      <div className='text-muted-foreground mt-0.5 text-xs'>
                        {t('after top-up 300₽ bonus')}
                      </div>
                    )}
                  </div>
                  <div className='bg-border/40 h-px' />
                  <div className='flex items-center justify-between'>
                    <div>
                      <div className='text-muted-foreground mb-0.5 text-xs'>{t('Direct cost')}</div>
                      <div className='text-muted-foreground text-base tabular-nums line-through'>
                        {fmt(retailCost)}
                      </div>
                    </div>
                    {saved > 0 && (
                      <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400'>
                        {t('Save')} {fmt(saved)}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  className='group w-full rounded-xl'
                  render={<Link to='/sign-up' />}
                >
                  {t('Start saving now')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <p className='text-muted-foreground mt-3 text-xs'>
                  {t('No card required · Cancel anytime')}
                </p>
              </div>
            </div>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
