import { Settings, Zap, BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

function CodePanel() {
  const { t } = useTranslation()
  return (
    <div className='border-border/40 bg-muted/5 overflow-hidden rounded-xl border'>
      {/* Window chrome */}
      <div className='border-border/30 bg-muted/20 flex items-center gap-1.5 border-b px-4 py-3'>
        <div className='size-3 rounded-full bg-red-400/60' />
        <div className='size-3 rounded-full bg-yellow-400/60' />
        <div className='size-3 rounded-full bg-emerald-400/60' />
        <span className='text-muted-foreground ml-3 text-[11px] font-mono'>example.py</span>
      </div>
      {/* Code */}
      <pre className='overflow-x-auto p-5 text-[13px] leading-[1.7] font-mono'>
        <code>
          <span className='text-violet-400'>from</span>
          <span className='text-foreground/80'> anthropic </span>
          <span className='text-violet-400'>import</span>
          <span className='text-foreground/80'> Anthropic{'\n\n'}</span>

          <span className='text-foreground/80'>client = Anthropic({'\n'}</span>
          <span className='text-foreground/80'>{'    '}api_key=</span>
          <span className='text-emerald-400'>"sk-your-key"</span>
          <span className='text-foreground/80'>,{'\n'}</span>
          <span className='text-foreground/80'>{'    '}base_url=</span>
          <span className='text-emerald-400'>"https://apinet.cloud"</span>
          <span className='text-muted-foreground'>{'  '}# ← {t('only one change')}{'\n'}</span>
          <span className='text-foreground/80'>){'\n\n'}</span>

          <span className='text-foreground/80'>response = client.messages.create({'\n'}</span>
          <span className='text-foreground/80'>{'    '}model=</span>
          <span className='text-emerald-400'>"claude-opus-4-7"</span>
          <span className='text-foreground/80'>,{'\n'}</span>
          <span className='text-foreground/80'>{'    '}max_tokens=</span>
          <span className='text-blue-400'>1024</span>
          <span className='text-foreground/80'>,{'\n'}</span>
          <span className='text-foreground/80'>{'    '}messages=[&#123;</span>
          <span className='text-emerald-400'>"role"</span>
          <span className='text-foreground/80'>: </span>
          <span className='text-emerald-400'>"user"</span>
          <span className='text-foreground/80'>, </span>
          <span className='text-emerald-400'>"content"</span>
          <span className='text-foreground/80'>: </span>
          <span className='text-emerald-400'>"Hello!"</span>
          <span className='text-foreground/80'>&#125;]{'\n'}</span>
          <span className='text-foreground/80'>){'\n'}</span>
          <span className='text-muted-foreground'># {t('This request cost')} ~$0.40/1M {t('vs')} $3.00/1M {t('direct')}</span>
        </code>
      </pre>

      {/* Savings badge */}
      <div className='border-border/30 bg-emerald-500/5 flex items-center gap-3 border-t px-5 py-3'>
        <div className='size-2 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.4)]' />
        <span className='text-emerald-600 dark:text-emerald-400 text-xs font-medium'>
          {t('Same SDK, same code')} — {t('change only')} base_url
        </span>
      </div>
    </div>
  )
}

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Register'),
      desc: t('Create an account and top up your balance. No card required to start.'),
      icon: <Settings className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Get API Key'),
      desc: t('Generate your key in the dashboard. Works with OpenAI, Anthropic, Gemini SDKs out of the box.'),
      icon: <Zap className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Change base_url'),
      desc: t('One line of code. Point your existing SDK to apinet.cloud and start saving immediately.'),
      icon: <BarChart3 className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Quick Start')}
          </p>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('From sign-up to first request')} — {t('3 minutes')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-3 max-w-md text-sm'>
            {t('No infrastructure changes. Drop-in replacement for any OpenAI-compatible SDK.')}
          </p>
        </AnimateInView>

        <div className='grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-start'>
          {/* Steps */}
          <div className='space-y-8'>
            {steps.map((step, i) => (
              <AnimateInView
                key={step.num}
                delay={i * 120}
                animation='fade-up'
                className='flex gap-5'
              >
                <div className='relative shrink-0'>
                  <div className='text-muted-foreground border-border/50 bg-muted/30 flex size-12 items-center justify-center rounded-xl border transition-colors'>
                    {step.icon}
                  </div>
                  <div className='bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-bold'>
                    {step.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div className='bg-border/40 absolute top-14 left-1/2 h-8 w-px -translate-x-1/2' />
                  )}
                </div>
                <div className='pt-1'>
                  <h3 className='mb-1.5 text-sm font-semibold'>{step.title}</h3>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {step.desc}
                  </p>
                </div>
              </AnimateInView>
            ))}
          </div>

          {/* Code panel */}
          <AnimateInView delay={200} animation='fade-up'>
            <CodePanel />
          </AnimateInView>
        </div>
      </div>
    </section>
  )
}
