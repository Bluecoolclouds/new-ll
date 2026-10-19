import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function GreetingHeader() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const name = user?.display_name || user?.username || 'there'

  return (
    <div className='flex min-w-0 items-center gap-3'>
      <span className='bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-xl'>
        <Sparkles className='text-primary size-5' />
      </span>
      <div className='min-w-0'>
        <h2 className='truncate text-lg font-semibold tracking-tight'>
          {t(getGreeting())}, {name}!
        </h2>
        <p className='text-muted-foreground text-xs leading-snug'>
          {t('Manage your API keys, track usage, and explore models.')}
        </p>
      </div>
    </div>
  )
}
