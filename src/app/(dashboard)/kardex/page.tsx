import type { Metadata } from 'next'
import { getKardex } from '@/actions/kardex.actions'
import { KardexClient } from '@/components/kardex/KardexClient'

export const metadata: Metadata = { title: 'Kardex' }
export const dynamic = 'force-dynamic'

export default async function KardexPage() {
  const result = await getKardex()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movements = (result.success && result.data) ? result.data as any : []
  return <KardexClient initialMovements={movements} />
}
