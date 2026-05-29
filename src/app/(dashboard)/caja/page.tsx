import type { Metadata } from 'next'
import { getResumenFinanciero } from '@/actions/caja.actions'
import { CajaClient } from '@/components/caja/CajaClient'

export const metadata: Metadata = { title: 'Caja' }
export const dynamic = 'force-dynamic'

export default async function CajaPage() {
  const result = await getResumenFinanciero()

  if (!result.success || !result.data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400">Error al cargar los datos financieros.</p>
      </div>
    )
  }

  return <CajaClient data={result.data} />
}
