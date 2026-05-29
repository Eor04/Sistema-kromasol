import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ClientesClient } from '@/components/clientes/ClientesClient'

export const metadata: Metadata = { title: 'Clientes' }
export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  const customers = await prisma.customer.findMany({
    include: { _count: { select: { sales: true } } },
    orderBy: { name: 'asc' },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ClientesClient initialCustomers={customers as any} />
}
