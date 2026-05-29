import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getPurchases } from '@/actions/purchase.actions'
import { PurchasesClient } from '@/components/compras/PurchasesClient'

export const metadata: Metadata = { title: 'Compras' }
export const dynamic = 'force-dynamic'

export default async function ComprasPage() {
  const [products, purchasesResult] = await Promise.all([
    prisma.product.findMany({
      include: {
        variants: { orderBy: { baseContentQty: 'desc' } },
      },
      orderBy: { name: 'asc' },
    }),
    getPurchases(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchases = (purchasesResult.success && purchasesResult.data) ? purchasesResult.data as any : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PurchasesClient products={products as any} initialPurchases={purchases} />
}
