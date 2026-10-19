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

const pallySchema = z.object({
  PallyApiToken: z.string(),
  PallyShopID: z.string(),
  PallyUnitPrice: z.coerce.number().min(0),
  PallyMinTopUp: z.coerce.number().min(0),
})

export type PallySettingsValues = z.infer<typeof pallySchema>

interface Props {
  defaultValues: PallySettingsValues
}

export function PallySettingsSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const initialRef = React.useRef(defaultValues)
  const defaultsSignature = React.useMemo(
    () => JSON.stringify(defaultValues),
    [defaultValues]
  )

  const form = useForm({
    resolver: zodResolver(pallySchema),
    mode: 'onChange',
    defaultValues,
  })

  const didMountRef = React.useRef(false)
  React.useEffect(() => {
    const parsed = JSON.parse(defaultsSignature) as PallySettingsValues
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

    if (values.PallyApiToken !== initial.PallyApiToken) {
      updates.push({ key: 'PallyApiToken', value: values.PallyApiToken })
    }
    if (values.PallyShopID !== initial.PallyShopID) {
      updates.push({ key: 'PallyShopID', value: values.PallyShopID })
    }
    if (values.PallyUnitPrice !== initial.PallyUnitPrice) {
      updates.push({ key: 'PallyUnitPrice', value: values.PallyUnitPrice })
    }
    if (values.PallyMinTopUp !== initial.PallyMinTopUp) {
      updates.push({ key: 'PallyMinTopUp', value: values.PallyMinTopUp })
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
      toast.success(t('Pally settings saved'))
    } catch {
      toast.error(t('Failed to save Pally settings'))
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
            {saving ? t('Saving...') : t('Save Pally settings')}
          </Button>
        </SettingsPageActionsPortal>

        <div className='space-y-4 pt-4'>
          <div>
            <h3 className='text-lg font-medium'>{t('Pally Payment (RUB)')}</h3>
            <p className='text-muted-foreground text-sm'>
              {t('Accept RUB payments (СБП / Card) via Pally. Get your credentials at pal24.pro.')}
            </p>
          </div>

          <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
            <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
            <ul className='list-inside list-disc space-y-1'>
              <li>
                {t('Result URL (postback):')}{' '}
                <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                  {'<ServerAddress>/api/pally/webhook'}
                </code>
              </li>
              <li>
                {t('Set this URL as Result URL in your Pally shop settings at pal24.pro.')}
              </li>
              <li>
                {t('Unit Price = RUB per 1 credit (e.g. 0.0002 means 100 RUB = 500 000 credits = $1).')}
              </li>
            </ul>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='PallyApiToken'
              render={({ field }) => (
                <FormItem className='sm:col-span-2'>
                  <FormLabel>{t('API Token (Bearer)')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='password'
                      placeholder={t('72|oBCB7Z3SmUm1gvkp...')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='PallyShopID'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Shop ID')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='LXZv3R7Q8B' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='PallyUnitPrice'
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
              name='PallyMinTopUp'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum Top-Up (credits)')}</FormLabel>
                  <FormControl>
                    <Input {...field} type='number' placeholder='50' />
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
