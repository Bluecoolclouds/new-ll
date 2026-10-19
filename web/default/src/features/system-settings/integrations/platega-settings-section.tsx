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

const plategalSchema = z.object({
  PlategalMerchantId: z.string(),
  PlategalApiSecret: z.string(),
  PlategalUnitPrice: z.coerce.number().min(0),
  PlategalMinTopUp: z.coerce.number().min(0),
})

export type PlategalSettingsValues = z.infer<typeof plategalSchema>

interface Props {
  defaultValues: PlategalSettingsValues
}

export function PlategalSettingsSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const initialRef = React.useRef(defaultValues)
  const defaultsSignature = React.useMemo(
    () => JSON.stringify(defaultValues),
    [defaultValues]
  )

  const form = useForm({
    resolver: zodResolver(plategalSchema),
    mode: 'onChange',
    defaultValues,
  })

  const didMountRef = React.useRef(false)
  React.useEffect(() => {
    const parsed = JSON.parse(defaultsSignature) as PlategalSettingsValues
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

    if (values.PlategalMerchantId !== initial.PlategalMerchantId) {
      updates.push({ key: 'PlategalMerchantId', value: values.PlategalMerchantId })
    }
    if (values.PlategalApiSecret !== initial.PlategalApiSecret) {
      updates.push({ key: 'PlategalApiSecret', value: values.PlategalApiSecret })
    }
    if (values.PlategalUnitPrice !== initial.PlategalUnitPrice) {
      updates.push({ key: 'PlategalUnitPrice', value: values.PlategalUnitPrice })
    }
    if (values.PlategalMinTopUp !== initial.PlategalMinTopUp) {
      updates.push({ key: 'PlategalMinTopUp', value: values.PlategalMinTopUp })
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
      toast.success(t('Platega settings saved'))
    } catch {
      toast.error(t('Failed to save Platega settings'))
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
            {saving ? t('Saving...') : t('Save Platega settings')}
          </Button>
        </SettingsPageActionsPortal>

        <div className='space-y-4 pt-4'>
          <div>
            <h3 className='text-lg font-medium'>{t('Platega Payment (RUB)')}</h3>
            <p className='text-muted-foreground text-sm'>
              {t('Accept RUB payments (СБП / Card) via Platega. Get your credentials at platega.io.')}
            </p>
          </div>

          <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
            <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
            <ul className='list-inside list-disc space-y-1'>
              <li>
                {t('Callback URL:')}{' '}
                <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                  {'<ServerAddress>/api/plategal/webhook'}
                </code>
              </li>
              <li>
                {t('Set this URL in Platega personal account: Settings → Callback URLs.')}
              </li>
              <li>
                {t('Unit Price = RUB per 1 credit (e.g. 0.0002 means 100 RUB = 500 000 credits = $1).')}
              </li>
            </ul>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='PlategalMerchantId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Merchant ID (X-MerchantId)')}</FormLabel>
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
              name='PlategalApiSecret'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('API Secret (X-Secret)')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='password'
                      placeholder={t('Your Platega API secret')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='PlategalUnitPrice'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Unit Price (RUB per 1 credit)')}</FormLabel>
                  <FormControl>
                    <Input {...field} type='number' step='0.000001' placeholder='0.0002' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='PlategalMinTopUp'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum Top-Up (RUB)')}</FormLabel>
                  <FormControl>
                    <Input {...field} type='number' placeholder='100' />
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
