import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Send, ExternalLink, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useAuthRedirect } from '../hooks/use-auth-redirect'

interface TelegramLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  botName: string
}

type SessionStatus = 'idle' | 'loading' | 'pending' | 'confirmed' | 'expired' | 'error'

export function TelegramLoginDialog({
  open,
  onOpenChange,
  botName,
}: TelegramLoginDialogProps) {
  const { t } = useTranslation()
  const { handleLoginSuccess } = useAuthRedirect()
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [token, setToken] = useState<string>('')
  const [botLink, setBotLink] = useState<string>('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const initSession = async () => {
    setStatus('loading')
    try {
      const res = await api.post('/api/auth/tgbot/init')
      if (res.data?.success) {
        setToken(res.data.token)
        setBotLink(res.data.bot_link)
        setStatus('pending')
      } else {
        toast.error(res.data?.message || t('Failed to initialize Telegram login'))
        setStatus('error')
      }
    } catch {
      toast.error(t('Failed to initialize Telegram login'))
      setStatus('error')
    }
  }

  useEffect(() => {
    if (open) {
      initSession()
    } else {
      stopPolling()
      setStatus('idle')
      setToken('')
      setBotLink('')
    }
    return () => stopPolling()
  }, [open])

  useEffect(() => {
    if (status !== 'pending' || !token) return
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/auth/tgbot/poll?token=${token}`)
        if (!res.data?.success) return
        const s = res.data.status
        if (s === 'confirmed') {
          stopPolling()
          setStatus('confirmed')
          await handleLoginSuccess(res.data.data ?? res.data)
          onOpenChange(false)
        } else if (s === 'expired') {
          stopPolling()
          setStatus('expired')
        }
      } catch {
        // silently ignore poll errors
      }
    }, 2000)
    return () => stopPolling()
  }, [status, token])

  if (!botName) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Send className='h-5 w-5 text-blue-500' />
            {t('Sign in with Telegram')}
          </DialogTitle>
          <DialogDescription>
            {t('Scan the QR code or open the bot link to sign in')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col items-center gap-4 py-2'>
          {status === 'loading' && (
            <div className='flex items-center gap-2 py-8 text-muted-foreground'>
              <Loader2 className='h-5 w-5 animate-spin' />
              <span className='text-sm'>{t('Generating login link...')}</span>
            </div>
          )}

          {status === 'pending' && botLink && (
            <>
              <div className='rounded-xl border p-3 bg-white'>
                <QRCodeSVG value={botLink} size={180} />
              </div>
              <p className='text-muted-foreground text-xs text-center'>
                {t('Scan with your phone camera or Telegram app')}
              </p>
              <Button
                className='w-full gap-2'
                onClick={() => window.open(botLink, '_blank')}
              >
                <ExternalLink className='h-4 w-4' />
                {t('Open @{{botName}} in Telegram', { botName })}
              </Button>
              <div className='flex items-center gap-2 text-muted-foreground text-xs'>
                <Loader2 className='h-3 w-3 animate-spin' />
                {t('Waiting for confirmation...')}
              </div>
            </>
          )}

          {status === 'confirmed' && (
            <div className='flex flex-col items-center gap-2 py-6'>
              <CheckCircle2 className='h-10 w-10 text-green-500' />
              <p className='text-sm font-medium'>{t('Successfully signed in!')}</p>
            </div>
          )}

          {status === 'expired' && (
            <div className='flex flex-col items-center gap-3 py-4'>
              <Clock className='h-8 w-8 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>{t('Login link expired')}</p>
              <Button variant='outline' onClick={initSession}>
                {t('Generate new link')}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className='flex flex-col items-center gap-3 py-4'>
              <p className='text-sm text-destructive'>{t('Failed to generate login link')}</p>
              <Button variant='outline' onClick={initSession}>
                {t('Try again')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
