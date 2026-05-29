import type { Metadata } from 'next'
import { getProducts } from '@/actions/product.actions'
import { ProductosClient } from '@/components/productos/ProductosClient'

export const metadata: Metadata = { title: 'Productos' }
export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const result = await getProducts()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (result.success && result.data) ? result.data as any : []
  return <ProductosClient initialProducts={products} />
}
