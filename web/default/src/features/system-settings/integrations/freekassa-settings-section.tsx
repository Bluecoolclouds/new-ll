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
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageActionsPortal } from '../components/settings-page-context'
import { useUpdateOption } from '../hooks/use-update-option'

const freeKassaSchema = z.object({
  FreeKassaMerchantId: z.string().min(1, 'Merchant ID is required'),
  FreeKassaApiKey: z.string(),
  FreeKassaSecretWord1: z.string(),
  FreeKassaSecretWord2: z.string(),
  FreeKassaCurrency: z.string().min(1, 'Currency is required'),
  FreeKassaUnitPrice: z.coerce.number().min(0),
  FreeKassaMinTopUp: z.coerce.number().min(0),
  FreeKassaReturnURL: z.string(),
  FreeKassaPaymentSystemId: z.string(),
  FreeKassaCardPaymentSystemId: z.string(),
  FreeKassaCryptoPaymentSystemId: z.string(),
  FreeKassaFallbackEmail: z.string(),
  FreeKassaCBRMarkup: z.coerce.number(),
  FreeKassaCBRAutoSync: z.boolean(),
  FreeKassaEnableSBP: z.boolean(),
  FreeKassaEnableCard: z.boolean(),
  FreeKassaEnableCrypto: z.boolean(),
  FreeKassaEnableID32: z.boolean(),
  FreeKassaID32Name: z.string(),
})

export type FreeKassaSettingsValues = z.infer<typeof freeKassaSchema>

interface Props {
  defaultValues: FreeKassaSettingsValues
}

export function FreeKassaSettingsSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const initialRef = React.useRef(defaultValues)
  const defaultsSignature = React.useMemo(
    () => JSON.stringify(defaultValues),
    [defaultValues]
  )

  const form = useForm({
    resolver: zodResolver(freeKassaSchema),
    mode: 'onChange',
    defaultValues,
  })

  const didMountRef = React.useRef(false)
  React.useEffect(() => {
    const parsed = JSON.parse(defaultsSignature) as FreeKassaSettingsValues
    initialRef.current = parsed
    if (didMountRef.current) return
    didMountRef.current = true
    form.reset(parsed)
  }, [defaultsSignature, form])

  const [saving, setSaving] = React.useState(false)
  const [cbrFetching, setCbrFetching] = React.useState(false)
  const [cbrApplying, setCbrApplying] = React.useState(false)
  const [liveRate, setLiveRate] = React.useState<number | null>(null)
  const [fetchedAt, setFetchedAt] = React.useState<number | null>(null)

  const fetchCBRRate = async () => {
    setCbrFetching(true)
    try {
      const res = await api.get<{ success: boolean; rate: number; fetchedAt: number; message?: string }>('/api/option/cbr-rate')
      const data = res.data
      if (data.success) {
        setLiveRate(data.rate)
        setFetchedAt(data.fetchedAt)
        toast.success(t('CBR rate fetched: ') + data.rate.toFixed(4) + ' ₽/$')
      } else {
        toast.error(data.message || t('Failed to fetch CBR rate'))
      }
    } catch {
      toast.error(t('Failed to fetch CBR rate'))
    } finally {
      setCbrFetching(false)
    }
  }

  const applyCBRRate = async () => {
    setCbrApplying(true)
    try {
      const res = await api.post<{ success: boolean; rate: number; unitPrice: number; message?: string }>('/api/option/cbr-rate/apply')
      const data = res.data
      if (data.success) {
        setLiveRate(data.rate)
        form.setValue('FreeKassaUnitPrice', data.unitPrice)
        initialRef.current = { ...initialRef.current, FreeKassaUnitPrice: data.unitPrice }
        toast.success(data.message || t('CBR rate applied'))
      } else {
        toast.error(data.message || t('Failed to apply CBR rate'))
      }
    } catch {
      toast.error(t('Failed to apply CBR rate'))
    } finally {
      setCbrApplying(false)
    }
  }

  const handleSave = async () => {
    const valid = await form.trigger()
    if (!valid) return

    const values = form.getValues()
    const initial = initialRef.current
    const updates: { key: string; value: string | number }[] = []

    if (values.FreeKassaMerchantId !== initial.FreeKassaMerchantId) {
      updates.push({ key: 'FreeKassaMerchantId', value: values.FreeKassaMerchantId })
    }
    if (values.FreeKassaApiKey && values.FreeKassaApiKey !== initial.FreeKassaApiKey) {
      updates.push({ key: 'FreeKassaApiKey', value: values.FreeKassaApiKey })
    }
    if (values.FreeKassaSecretWord1 && values.FreeKassaSecretWord1 !== initial.FreeKassaSecretWord1) {
      updates.push({ key: 'FreeKassaSecretWord1', value: values.FreeKassaSecretWord1 })
    }
    if (values.FreeKassaSecretWord2 && values.FreeKassaSecretWord2 !== initial.FreeKassaSecretWord2) {
      updates.push({ key: 'FreeKassaSecretWord2', value: values.FreeKassaSecretWord2 })
    }
    if (values.FreeKassaCurrency !== initial.FreeKassaCurrency) {
      updates.push({ key: 'FreeKassaCurrency', value: values.FreeKassaCurrency })
    }
    if (values.FreeKassaUnitPrice !== initial.FreeKassaUnitPrice) {
      updates.push({ key: 'FreeKassaUnitPrice', value: values.FreeKassaUnitPrice })
      updates.push({
        key: 'general_setting.custom_currency_exchange_rate',
        value: values.FreeKassaUnitPrice,
      })
    }
    if (values.FreeKassaMinTopUp !== initial.FreeKassaMinTopUp) {
      updates.push({ key: 'FreeKassaMinTopUp', value: values.FreeKassaMinTopUp })
    }
    if (values.FreeKassaReturnURL !== initial.FreeKassaReturnURL) {
      updates.push({ key: 'FreeKassaReturnURL', value: values.FreeKassaReturnURL })
    }
    if (values.FreeKassaPaymentSystemId !== initial.FreeKassaPaymentSystemId) {
      updates.push({ key: 'FreeKassaPaymentSystemId', value: values.FreeKassaPaymentSystemId })
    }
    if (values.FreeKassaCardPaymentSystemId !== initial.FreeKassaCardPaymentSystemId) {
      updates.push({ key: 'FreeKassaCardPaymentSystemId', value: values.FreeKassaCardPaymentSystemId })
    }
    if (values.FreeKassaCryptoPaymentSystemId !== initial.FreeKassaCryptoPaymentSystemId) {
      updates.push({ key: 'FreeKassaCryptoPaymentSystemId', value: values.FreeKassaCryptoPaymentSystemId })
    }
    if (values.FreeKassaFallbackEmail !== initial.FreeKassaFallbackEmail) {
      updates.push({ key: 'FreeKassaFallbackEmail', value: values.FreeKassaFallbackEmail })
    }
    if (values.FreeKassaCBRMarkup !== initial.FreeKassaCBRMarkup) {
      updates.push({ key: 'FreeKassaCBRMarkup', value: values.FreeKassaCBRMarkup })
    }
    if (values.FreeKassaCBRAutoSync !== initial.FreeKassaCBRAutoSync) {
      updates.push({ key: 'FreeKassaCBRAutoSync', value: String(values.FreeKassaCBRAutoSync) })
    }
    if (values.FreeKassaEnableSBP !== initial.FreeKassaEnableSBP) {
      updates.push({ key: 'FreeKassaEnableSBP', value: String(values.FreeKassaEnableSBP) })
    }
    if (values.FreeKassaEnableCard !== initial.FreeKassaEnableCard) {
      updates.push({ key: 'FreeKassaEnableCard', value: String(values.FreeKassaEnableCard) })
    }
    if (values.FreeKassaEnableCrypto !== initial.FreeKassaEnableCrypto) {
      updates.push({ key: 'FreeKassaEnableCrypto', value: String(values.FreeKassaEnableCrypto) })
    }
    if (values.FreeKassaEnableID32 !== initial.FreeKassaEnableID32) {
      updates.push({ key: 'FreeKassaEnableID32', value: String(values.FreeKassaEnableID32) })
    }
    if (values.FreeKassaID32Name !== initial.FreeKassaID32Name) {
      updates.push({ key: 'FreeKassaID32Name', value: values.FreeKassaID32Name })
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
      toast.success(t('FreeKassa settings saved'))
    } catch (_err) {
      toast.error(t('Failed to save FreeKassa settings'))
    } finally {
      setSaving(false)
    }
  }

  const cbrMarkup = form.watch('FreeKassaCBRMarkup')
  const computedUnitPrice =
    liveRate !== null
      ? Math.ceil(liveRate) + (Number(cbrMarkup) || 0)
      : null

  return (
    <div className='space-y-4 pt-4'>
      <SettingsPageActionsPortal>
        <Button
          type='button'
          size='sm'
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('Saving...') : t('Save FreeKassa settings')}
        </Button>
      </SettingsPageActionsPortal>

      <div>
        <h3 className='text-lg font-medium'>{t('FreeKassa')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Accept payments via FreeKassa — a popular Russian payment aggregator. Configure your merchant credentials to enable RUB top-ups.'
          )}
        </p>
      </div>

      <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
        <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
        <ul className='list-inside list-disc space-y-1'>
          <li>
            {t('Notification URL:')}{' '}
            <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
              {'<ServerAddress>/api/freekassa/notify'}
            </code>
          </li>
          <li>
            {t('Set this URL in your FreeKassa merchant dashboard under «Технические настройки».')}
          </li>
          <li>
            {t('Configure at:')}{' '}
            <a
              href='https://www.freekassa.net/merchantca/settings'
              target='_blank'
              rel='noreferrer'
              className='underline hover:no-underline'
            >
              {t('FreeKassa Dashboard')}
            </a>
          </li>
        </ul>
      </div>

      <div className='rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950'>
        <p className='mb-2 text-sm font-medium text-amber-900 dark:text-amber-100'>
          {t('CBR USD/RUB Rate (Bank of Russia)')}
        </p>
        <p className='mb-3 text-xs text-amber-700 dark:text-amber-300'>
          {t(
            'Fetch the official USD/RUB exchange rate from the Bank of Russia. Apply it to automatically set the unit price and keep the wallet display rate in sync.'
          )}
        </p>

        {liveRate !== null && (
          <div className='mb-3 rounded bg-amber-100 px-3 py-2 text-sm dark:bg-amber-900'>
            <span className='font-medium'>{t('Live rate: ')}</span>
            <span className='font-mono'>{liveRate.toFixed(4)} ₽/$</span>
            {computedUnitPrice !== null && (
              <span className='ml-3 text-xs text-amber-700 dark:text-amber-400'>
                → {t('sell price: ')}
                <span className='font-mono font-medium'>{computedUnitPrice.toFixed(2)} ₽/$</span>
                {' '}
                <span className='opacity-70'>{t('(CBR + markup)')}</span>
              </span>
            )}
            {fetchedAt !== null && (
              <span className='ml-3 text-xs opacity-60'>
                {new Date(fetchedAt * 1000).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={fetchCBRRate}
            disabled={cbrFetching}
          >
            {cbrFetching ? t('Fetching...') : t('Fetch live rate')}
          </Button>
          <Button
            type='button'
            size='sm'
            onClick={applyCBRRate}
            disabled={cbrApplying}
            className='bg-amber-600 hover:bg-amber-700 text-white'
          >
            {cbrApplying ? t('Applying...') : t('Fetch & Apply to unit price')}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <SettingsForm
          onSubmit={(e) => e.preventDefault()}
          className='gap-y-4'
          data-no-autosubmit='true'
        >
          <FormField
            control={form.control}
            name='FreeKassaMerchantId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Merchant ID')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='12345'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaApiKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('API Key (for SBP / card payments via API v2)')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={t('Leave blank to keep existing')}
                    autoComplete='new-password'
                    {...field}
                  />
                </FormControl>
                <p className='text-muted-foreground text-xs'>
                  {t('Required for SBP (id=44) and card (id=36) payments. Find it in FreeKassa → API → API Key.')}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaSecretWord1'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Secret Word 1 (for payment URL signing)')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={t('Leave blank to keep existing')}
                    autoComplete='new-password'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaSecretWord2'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Secret Word 2 (for notification verification)')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={t('Leave blank to keep existing')}
                    autoComplete='new-password'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaCurrency'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Currency')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='RUB'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='rounded-md border p-3 space-y-3 bg-muted/30'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              {t('Rate Configuration')}
            </p>

            <FormField
              control={form.control}
              name='FreeKassaCBRMarkup'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('CBR Markup (₽, added to live CBR rate)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='0.01'
                      placeholder='0'
                      {...field}
                    />
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Your sell price = ceil(live CBR rate) + this markup. E.g. if CBR = 82.5 and markup = 0, unit price = 83. Use negative values to sell below CBR.'
                    )}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='FreeKassaCBRAutoSync'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between'>
                  <div>
                    <FormLabel>{t('Auto-sync rate every 6 hours')}</FormLabel>
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Automatically fetch the CBR rate and update the unit price every 6 hours. Both FreeKassa unit price and wallet display rate will be kept in sync.'
                      )}
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='FreeKassaUnitPrice'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Unit Price (₽ per $1 quota)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step='0.01'
                      placeholder='90'
                      {...field}
                    />
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'How many ₽ the user pays per $1 of quota. Must match the wallet display rate — saving this field will automatically update both. Use "Fetch & Apply" above to set from CBR.'
                    )}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='FreeKassaMinTopUp'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Minimum Top-up Amount (in quota dollars)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step='1'
                    placeholder='1'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaReturnURL'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Return URL (result page after payment)')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='https://your-site.com/wallet/freekassa/result'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Users will be redirected here after payment. Set to your site\'s /wallet/freekassa/result page. FreeKassa will append ?status=success or ?status=failed.'
                  )}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaPaymentSystemId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('SBP Payment System ID (parameter «i»)')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='44'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <p className='text-muted-foreground text-xs'>
                  {t('FreeKassa payment method ID for SBP (fast bank transfers). Default: 44.')}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaFallbackEmail'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Fallback Email')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='test@gmail.com'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <p className='text-muted-foreground text-xs'>
                  {t('Email sent to FreeKassa when the user has no email in their profile.')}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaCardPaymentSystemId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Card Payment System ID (Visa/MC/Mir)')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='6'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <p className='text-muted-foreground text-xs'>
                  {t('FreeKassa payment method ID for bank cards. Leave empty to hide this option. Common IDs: 6 (Visa/MC), 8 (Mir).')}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='FreeKassaCryptoPaymentSystemId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Crypto Payment System ID')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='171'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <p className='text-muted-foreground text-xs'>
                  {t('FreeKassa payment method ID for cryptocurrency. Leave empty to hide this option. Common IDs: 171 (USDT TRC20), 16 (Bitcoin), 40 (Ethereum).')}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='rounded-md border p-3 space-y-3 bg-muted/30'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              {t('Payment Method Visibility')}
            </p>
            <p className='text-xs text-muted-foreground'>
              {t('Enable or disable individual payment methods shown to users. Requires FreeKassa to be fully configured.')}
            </p>

            <FormField
              control={form.control}
              name='FreeKassaEnableSBP'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between'>
                  <div>
                    <FormLabel>{t('SBP (Fast Pay)')}</FormLabel>
                    <p className='text-muted-foreground text-xs'>
                      {t('Show the SBP / Fast Pay method (ID from «SBP Payment System ID» field above).')}
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='FreeKassaEnableCard'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between'>
                  <div>
                    <FormLabel>{t('Cards (Visa / MC / Mir)')}</FormLabel>
                    <p className='text-muted-foreground text-xs'>
                      {t('Show the bank card payment method (ID from «Card Payment System ID» field above).')}
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='FreeKassaEnableCrypto'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between'>
                  <div>
                    <FormLabel>{t('Crypto')}</FormLabel>
                    <p className='text-muted-foreground text-xs'>
                      {t('Show the cryptocurrency payment method (ID from «Crypto Payment System ID» field above).')}
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='FreeKassaEnableID32'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between'>
                  <div>
                    <FormLabel>{t('Payment Method ID 32 (Кассир.ру)')}</FormLabel>
                    <p className='text-muted-foreground text-xs'>
                      {t('Show FreeKassa payment system ID 32. Uses the name from the field below.')}
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='FreeKassaID32Name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ID 32 Display Name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Кассир.ру'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    {t('The name shown to users for payment method ID 32.')}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsForm>
      </Form>
    </div>
  )
}
