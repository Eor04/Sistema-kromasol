'use server'

import { kardexRepository } from '@/repositories/kardex.repository'
import { prisma } from '@/lib/prisma'

export async function getKardex(variantId?: number) {
  try {
    const data = variantId
      ? await kardexRepository.findByVariant(variantId)
      : await kardexRepository.findAll()
    return { success: true, data }
  } catch {
    return { success: false, error: 'Error al obtener el Kardex' }
  }
}

// Obtener detalle de una transacción por tipo y referenceId
export async function getMovementDetail(type: 'IN' | 'OUT' | 'ADJUST', referenceId: number) {
  try {
    if (type === 'OUT') {
      // Es una venta
      const sale = await prisma.sale.findUnique({
        where: { id: referenceId },
        include: {
          customer: { select: { name: true, phone: true } },
          details: {
            include: {
              variant: { include: { product: { select: { name: true, imageUrl: true } } } },
            },
          },
        },
      })
      if (!sale) return { success: false, error: 'Venta no encontrada' }
      return {
        success: true,
        type: 'SALE' as const,
        data: sale,
      }
    } else if (type === 'IN') {
      // Es una compra
      const purchase = await prisma.purchase.findUnique({
        where: { id: referenceId },
        include: {
          details: {
            include: {
              variant: { include: { product: { select: { name: true } } } },
            },
          },
        },
      })
      if (!purchase) return { success: false, error: 'Compra no encontrada' }
      return {
        success: true,
        type: 'PURCHASE' as const,
        data: purchase,
      }
    }
    return { success: false, error: 'Tipo no soportado' }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Error al obtener el detalle' }
  }
}
