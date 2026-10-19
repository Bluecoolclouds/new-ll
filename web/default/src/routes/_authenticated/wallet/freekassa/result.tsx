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
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FreeKassaResultPage } from '@/features/wallet/freekassa-result-page'

const resultSearchSchema = z.object({
  status: z.enum(['success', 'failed']).optional(),
  MERCHANT_ORDER_ID: z.string().optional(),
  AMOUNT: z.string().optional(),
  CUR_ID: z.string().optional(),
  SIGN: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/wallet/freekassa/result')(
  {
    component: RouteComponent,
    validateSearch: resultSearchSchema,
  }
)

function RouteComponent() {
  const { status, MERCHANT_ORDER_ID, AMOUNT } = Route.useSearch()
  return (
    <FreeKassaResultPage
      status={status}
      orderId={MERCHANT_ORDER_ID}
      amount={AMOUNT}
    />
  )
}
