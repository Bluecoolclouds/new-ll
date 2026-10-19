import * as React from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SettingsPageActionsPortal } from '../components/settings-page-context'
import { useUpdateOption } from '../hooks/use-update-option'

const heleketSchema = z.object({
  HeleketApiKey: z.string(),
  HeleketMerchantUUID: z.string(),
  HeleketCurrency: z.string().min(1, 'Currency is required'),
  HeleketUnitPrice: z.coerce.number().min(0),
  HeleketMinTopUp: z.coerce.number().min(0),
  HeleketReturnURL: z.string(),
})

export type HeleketSettingsValues = z.infer<typeof heleketSchema>

interface Props {
  defaultValues: HeleketSettingsValues
}

export function HeleketSettingsSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const initialRef = React.useRef(defaultValues)
  const defaultsSignature = React.useMemo(
    () => JSON.stringify(defaultValues),
    [defaultValues]
  )

  const form = useForm({
    resolver: zodResolver(heleketSchema),
    mode: 'onChange',
    defaultValues,
  })

  const didMountRef = React.useRef(false)
  React.useEffect(() => {
    const parsed = JSON.parse(defaultsSignature) as HeleketSettingsValues
    initialRef.current = parsed
    if (didMountRef.current) return
    didMountRef.current = true
    form.reset(parsed)
  }, [defaultsSignature, form])

  const [saving, setSaving] = React.useState(false)

  const handleSave = async () => {
    const valid = await form.trigger()
    if (!valid) return

    const values = form.getValues()
    const initial = initialRef.current
    const updates: { key: string; value: string | number }[] = []

    if (values.HeleketApiKey && values.HeleketApiKey !== initial.HeleketApiKey) {
      updates.push({ key: 'HeleketApiKey', value: values.HeleketApiKey })
    }
    if (values.HeleketMerchantUUID !== initial.HeleketMerchantUUID) {
      updates.push({ key: 'HeleketMerchantUUID', value: values.HeleketMerchantUUID })
    }
    if (values.HeleketCurrency !== initial.HeleketCurrency) {
      updates.push({ key: 'HeleketCurrency', value: values.HeleketCurrency })
    }
    if (values.HeleketUnitPrice !== initial.HeleketUnitPrice) {
      updates.push({ key: 'HeleketUnitPrice', value: values.HeleketUnitPrice })
    }
    if (values.HeleketMinTopUp !== initial.HeleketMinTopUp) {
      updates.push({ key: 'HeleketMinTopUp', value: values.HeleketMinTopUp })
    }
    if (values.HeleketReturnURL !== initial.HeleketReturnURL) {
      updates.push({ key: 'HeleketReturnURL', value: values.HeleketReturnURL })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    setSaving(true)
    try {
      await Promise.all(
        updates.map(({ key, value }) =>
          updateOption.mutateAsync({ key, value: String(value) })
        )
      )
      initialRef.current = { ...values }
      toast.success(t('Heleket settings saved'))
    } catch {
      toast.error(t('Failed to save Heleket settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form>
        <SettingsPageActionsPortal>
          <Button
            type='button'
            size='sm'
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('Saving...') : t('Save Heleket settings')}
          </Button>
        </SettingsPageActionsPortal>

        <div className='space-y-4 pt-4'>
          <div>
            <h3 className='text-lg font-medium'>{t('Heleket Crypto Payment')}</h3>
            <p className='text-muted-foreground text-sm'>
              {t('Accept crypto payments via Heleket. Get your API credentials at heleket.com.')}
            </p>
          </div>

          <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
            <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
            <ul className='list-inside list-disc space-y-1'>
              <li>
                {t('Callback URL:')}{' '}
                <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                  {'<ServerAddress>/api/heleket/webhook'}
                </code>
              </li>
              <li>
                {t('Set this URL in your Heleket merchant dashboard.')}
              </li>
            </ul>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='HeleketMerchantUUID'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Merchant UUID')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='HeleketApiKey'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('API Key')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='password'
                      placeholder={t('Your Heleket API key')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='HeleketCurrency'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Currency')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='USD' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='HeleketUnitPrice'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Unit Price (credits per $1)')}</FormLabel>
                  <FormControl>
                    <Input {...field} type='number' placeholder='1' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='HeleketMinTopUp'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum Top-Up (credits)')}</FormLabel>
                  <FormControl>
                    <Input {...field} type='number' placeholder='1' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='HeleketReturnURL'
              render={({ field }) => (
                <FormItem className='sm:col-span-2'>
                  <FormLabel>{t('Return URL')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder='https://your-domain.com/wallet'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </form>
    </Form>
  )
}
