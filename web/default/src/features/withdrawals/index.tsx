import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { WithdrawalsTable } from './components/withdrawals-table'

export function Withdrawals() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Withdrawal Requests')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <WithdrawalsTable />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
