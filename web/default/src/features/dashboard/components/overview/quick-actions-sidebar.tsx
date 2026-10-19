import { Link } from '@tanstack/react-router'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PanelWrapper } from '../ui/panel-wrapper'

interface QuickAction {
  title: string
  description: string
  to: string
  icon: LucideIcon
}

interface QuickActionsSidebarProps {
  actions: QuickAction[]
}

function ActionRow({ action }: { action: QuickAction }) {
  const Icon = action.icon
  return (
    <Link
      to={action.to}
      className='hover:bg-muted/40 focus-visible:ring-ring flex items-center gap-3 px-4 py-2.5 outline-none transition-colors focus-visible:ring-2 sm:px-5'
    >
      <span className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg'>
        <Icon className='size-3.5' />
      </span>
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='text-xs font-medium'>{action.title}</span>
        <span className='text-muted-foreground line-clamp-2 text-[11px]'>
          {action.description}
        </span>
      </span>
      <ChevronRight className='text-muted-foreground size-3.5 shrink-0' />
    </Link>
  )
}

export function QuickActionsSidebar({ actions }: QuickActionsSidebarProps) {
  const { t } = useTranslation()
  return (
    <PanelWrapper title={t('Quick Actions')} contentClassName='p-0'>
      <div className='divide-y'>
        {actions.map((action) => (
          <ActionRow key={action.title} action={action} />
        ))}
      </div>
    </PanelWrapper>
  )
}
