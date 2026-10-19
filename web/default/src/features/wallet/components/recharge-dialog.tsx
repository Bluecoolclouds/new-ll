import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Button } from '@/components/ui/button'
import { Dialog, DialogPortal, DialogTrigger } from '@/components/ui/dialog'
import {
  useTopupInfo,
  usePayment,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
} from '../hooks'
import { getDefaultPaymentType, getMinTopupAmount, isWaffoPancakePayment, getAmountDiscount } from '../lib'
import { DEFAULT_DISCOUNT_RATE } from '../constants'
import type { PaymentMethod, PresetAmount, CreemProduct } from '../types'
import { RechargeFormCard } from './recharge-form-card'
import { BillingHistoryDialog } from './dialogs/billing-history-dialog'
import { CreemConfirmDialog } from './dialogs/creem-confirm-dialog'

function RechargeContent() {
  const { status } = useStatus()
  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()

  const effectiveUsdExchangeRate =
    currency?.quotaDisplayType === 'USD' ? 1 : currency?.usdExchangeRate || 1

  const {
    amount: paymentAmount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
  } = usePayment()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } = useWaffoPancakePayment()

  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>()
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] = useState<CreemProduct | null>(null)

  useEffect(() => {
    if (topupInfo && topupAmount === 0) {
      const minTopup = getMinTopupAmount(topupInfo)
      setTopupAmount(minTopup)
      const defaultPaymentType = getDefaultPaymentType(topupInfo)
      calculatePaymentAmount(minTopup, defaultPaymentType)
    }
  }, [topupInfo, topupAmount, calculatePaymentAmount])

  const getCurrentPaymentType = useCallback(
    () => selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo),
    [selectedPaymentMethod, topupInfo]
  )

  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    calculatePaymentAmount(preset.value, getCurrentPaymentType())
  }

  const amountDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTopupAmountChange = useCallback(
    (amount: number) => {
      setTopupAmount(amount)
      setSelectedPreset(null)
      if (amountDebounceRef.current) clearTimeout(amountDebounceRef.current)
      amountDebounceRef.current = setTimeout(() => {
        calculatePaymentAmount(amount, getCurrentPaymentType())
      }, 400)
    },
    [calculatePaymentAmount, getCurrentPaymentType]
  )

  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    setPaymentLoading(method.type)
    try {
      const minTopup = getMinTopupAmount(topupInfo)
      if (topupAmount < minTopup) return
      await calculatePaymentAmount(topupAmount, method.type)

      const isPancake = isWaffoPancakePayment(method.type)
      await (isPancake
        ? processWaffoPancakePayment(topupAmount)
        : processPayment(topupAmount, method.type))
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleRedeem = async () => {
    if (!redemptionCode) return
    const success = await redeemCode(redemptionCode)
    if (success) setRedemptionCode('')
  }

  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return
    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      setSelectedCreemProduct(null)
    }
  }

  const handleWaffoMethodSelect = async (_method: unknown, index: number) => {
    const loadingKey = `waffo-${index}`
    setPaymentLoading(loadingKey)
    try {
      await processWaffoPayment(topupAmount, index)
    } finally {
      setPaymentLoading(null)
    }
  }

  const getDiscountRate = useCallback(() => {
    if (!topupInfo?.discount || Object.keys(topupInfo.discount).length === 0) {
      return DEFAULT_DISCOUNT_RATE
    }
    return getAmountDiscount(topupAmount, topupInfo.discount)
  }, [topupInfo, topupAmount])

  const handleMethodChange = useCallback(
    async (method: PaymentMethod) => {
      setSelectedPaymentMethod(method)
      await calculatePaymentAmount(topupAmount, method.type)
    },
    [topupAmount, calculatePaymentAmount]
  )

  return (
    <>
      <RechargeFormCard
        topupInfo={topupInfo}
        presetAmounts={presetAmounts}
        selectedPreset={selectedPreset}
        onSelectPreset={handleSelectPreset}
        topupAmount={topupAmount}
        onTopupAmountChange={handleTopupAmountChange}
        paymentAmount={paymentAmount}
        calculating={calculating}
        onPaymentMethodSelect={handlePaymentMethodSelect}
        paymentLoading={paymentLoading}
        redemptionCode={redemptionCode}
        onRedemptionCodeChange={setRedemptionCode}
        onRedeem={handleRedeem}
        redeeming={redeeming}
        topupLink={topupInfo?.topup_link}
        loading={topupLoading}
        priceRatio={(status?.price as number) || 1}
        usdExchangeRate={effectiveUsdExchangeRate}
        rawUsdExchangeRate={
          (currency?.customCurrencyExchangeRate ?? 0) > 1
            ? currency!.customCurrencyExchangeRate!
            : currency?.usdExchangeRate || 1
        }
        onOpenBilling={() => setBillingDialogOpen(true)}
        creemProducts={topupInfo?.creem_products}
        enableCreemTopup={topupInfo?.enable_creem_topup}
        onCreemProductSelect={handleCreemProductSelect}
        enableWaffoTopup={topupInfo?.enable_waffo_topup}
        waffoPayMethods={topupInfo?.waffo_pay_methods}
        waffoMinTopup={topupInfo?.waffo_min_topup}
        onWaffoMethodSelect={handleWaffoMethodSelect}
        enableWaffoPancakeTopup={topupInfo?.enable_waffo_pancake_topup}
        enableFreeKassaTopup={topupInfo?.enable_freekassa_topup}
        freekassaCardEnabled={topupInfo?.freekassa_card_enabled}
        freekassaCryptoEnabled={topupInfo?.freekassa_crypto_enabled}
        freekassaUnitPrice={topupInfo?.freekassa_unit_price}
        freekassaCbrRate={topupInfo?.freekassa_cbr_rate}
        enableHeleketTopup={topupInfo?.enable_heleket_topup}
        enablePallyTopup={topupInfo?.enable_pally_topup}
        onMethodChange={handleMethodChange}
        discountRate={getDiscountRate()}
      />


      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />
    </>
  )
}

export function RechargeDialog(props: { triggerClassName?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size='sm' className={props.triggerClassName}>
            <Plus className='size-3.5' aria-hidden='true' />
            {t('Top Up')}
          </Button>
        }
      />
      <DialogPortal>
        <DialogPrimitive.Backdrop className='data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm duration-100' />
        <DialogPrimitive.Popup
          aria-label={t('Add Funds')}
          className='data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl duration-100 outline-none sm:max-w-lg'
        >
          {/* close button */}
          <DialogPrimitive.Close
            render={
              <Button
                variant='ghost'
                size='icon-sm'
                className='absolute top-2 right-2 z-10'
                aria-label='Close'
              />
            }
          >
            <X className='size-4' aria-hidden='true' />
          </DialogPrimitive.Close>

          <div className='min-h-0 flex-1 overflow-y-auto'>
            {open && <RechargeContent />}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
