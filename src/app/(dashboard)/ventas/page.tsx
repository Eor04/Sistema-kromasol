import { prisma } from '@/lib/prisma'
import { VentasClient } from '@/components/ventas/VentasClient'
import { getSales } from '@/actions/sale.actions'

export const dynamic = 'force-dynamic'

export default async function VentasPage() {
  const [products, customers, salesResult] = await Promise.all([
    prisma.product.findMany({
      include: {
        variants: { orderBy: { baseContentQty: 'desc' } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    getSales(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sales = (salesResult.success && salesResult.data) ? salesResult.data as any : []

  return <VentasClient products={products} customers={customers} initialSales={sales} />
}
