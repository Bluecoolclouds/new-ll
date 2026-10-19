import { Gift, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RedemptionCodeCardProps {
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
}

export function RedemptionCodeCard({
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
}: RedemptionCodeCardProps) {
  const { t } = useTranslation()

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='space-y-3 p-3 sm:p-4'>
        <div className='flex items-center gap-2'>
          <Gift className='text-muted-foreground h-4 w-4 shrink-0' />
          <Label
            htmlFor='wallet-redemption-code'
            className='text-muted-foreground cursor-pointer text-xs font-medium tracking-wider uppercase'
          >
            {t('Have a Code?')}
          </Label>
        </div>
        <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
          <Input
            id='wallet-redemption-code'
            value={redemptionCode}
            onChange={(e) => onRedemptionCodeChange(e.target.value)}
            placeholder={t('Enter your redemption code')}
            className='h-9 min-w-0'
            onKeyDown={(e) => {
              if (e.key === 'Enter' && redemptionCode.trim() && !redeeming) {
                onRedeem()
              }
            }}
          />
          <Button
            onClick={onRedeem}
            disabled={redeeming || !redemptionCode.trim()}
            variant='outline'
            className='h-9 px-4'
          >
            {redeeming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Redeem')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
