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
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FreeKassaResultPageProps {
  status: 'success' | 'failed' | undefined
  orderId: string | undefined
  amount: string | undefined
}

export function FreeKassaResultPage({
  status,
  orderId,
  amount,
}: FreeKassaResultPageProps) {
  const { t } = useTranslation()

  const isSuccess = status === 'success'
  const isFailed = status === 'failed'
  const isPending = !isSuccess && !isFailed

  return (
    <div className='flex min-h-[60vh] items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='mb-4 flex justify-center'>
            {isPending ? (
              <Loader2 className='text-muted-foreground h-16 w-16 animate-spin' />
            ) : isSuccess ? (
              <CheckCircle2 className='h-16 w-16 text-green-500' />
            ) : (
              <XCircle className='h-16 w-16 text-red-500' />
            )}
          </div>
          <CardTitle className='text-xl'>
            {isPending
              ? t('Processing Payment')
              : isSuccess
                ? t('Payment Successful')
                : t('Payment Failed')}
          </CardTitle>
        </CardHeader>

        <CardContent className='space-y-4 text-center'>
          {isPending && (
            <p className='text-muted-foreground text-sm'>
              {t('Your payment is being processed. Please wait...')}
            </p>
          )}

          {isSuccess && (
            <>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Your payment was received successfully. Your balance has been updated.'
                )}
              </p>
              {(orderId || amount) && (
                <div className='rounded-md bg-green-50 p-3 text-sm dark:bg-green-950'>
                  {orderId && (
                    <p className='text-green-800 dark:text-green-200'>
                      <span className='font-medium'>{t('Order ID:')}</span>{' '}
                      {orderId}
                    </p>
                  )}
                  {amount && (
                    <p className='text-green-800 dark:text-green-200'>
                      <span className='font-medium'>{t('Amount paid:')}</span>{' '}
                      {amount}
                    </p>
                  )}
                </div>
              )}
              <p className='text-muted-foreground text-xs'>
                {t(
                  'If your balance has not updated yet, please wait a moment and refresh the wallet page.'
                )}
              </p>
            </>
          )}

          {isFailed && (
            <>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Your payment could not be completed. No charges were made.'
                )}
              </p>
              {orderId && (
                <div className='rounded-md bg-red-50 p-3 text-sm dark:bg-red-950'>
                  <p className='text-red-800 dark:text-red-200'>
                    <span className='font-medium'>{t('Order ID:')}</span>{' '}
                    {orderId}
                  </p>
                </div>
              )}
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Please try again. If the problem persists, contact support.'
                )}
              </p>
            </>
          )}

          <div className='flex flex-col gap-2 pt-2'>
            <Button asChild>
              <Link to='/wallet'>
                {isSuccess ? t('Go to Wallet') : t('Try Again')}
              </Link>
            </Button>
            {isFailed && (
              <Button variant='outline' asChild>
                <Link to='/'>
                  {t('Back to Home')}
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
