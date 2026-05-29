'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { MovementType } from '@prisma/client'
import { customerRepository } from '@/repositories/customer.repository'

const SaleDetailSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  unitPrice: z.coerce.number().positive('El precio debe ser mayor a 0'),
})

const RegisterSaleSchema = z.object({
  customerId: z.coerce.number().int().positive().optional().nullable(),
  isCredit: z.boolean().default(false),
  paymentMethod: z.enum(['EFECTIVO', 'QR', 'TRANSFERENCIA']).default('EFECTIVO'),
  details: z.array(SaleDetailSchema).min(1, 'Debe agregar al menos un producto'),
})

export type RegisterSaleInput = z.infer<typeof RegisterSaleSchema>

/**
 * POOL UNIFICADO POR PRODUCTO:
 * El stock vive en Product.stockInBaseUnits.
 * Vender 1 Caja de SUPERNOVA → SUPERNOVA.stockInBaseUnits -= 36
 * Vender 5 Sobres de SUPERNOVA → SUPERNOVA.stockInBaseUnits -= 5
 * Ambas operaciones comparten el mismo pool de 149 sobres.
 */
export async function registerSale(input: RegisterSaleInput) {
  const parsed = RegisterSaleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { customerId, isCredit, paymentMethod, details } = parsed.data
  const totalAmount = details.reduce((sum, d) => sum + d.quantity * d.unitPrice, 0)

  try {
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Verificar stock ANTES de cualquier movimiento
      for (const detail of details) {
        const variant = await tx.variant.findUnique({
          where: { id: detail.variantId },
          include: { product: true },
        })
        if (!variant) throw new Error(`Variante ${detail.variantId} no encontrada`)

        const baseUnitsNeeded = detail.quantity * variant.baseContentQty
        const available = variant.product.stockInBaseUnits

        if (available < baseUnitsNeeded) {
          const availablePresentations = Math.floor(available / variant.baseContentQty)
          throw new Error(
            `Stock insuficiente en "${variant.product.name} — ${variant.presentation}": ` +
            `disponible ${available} ${variant.baseUnitName} ` +
            `(≈ ${availablePresentations} ${variant.presentation}), ` +
            `necesitas ${baseUnitsNeeded} ${variant.baseUnitName}`
          )
        }
      }

      // 2. Crear venta
      const newSale = await tx.sale.create({
        data: { totalAmount, isCredit, paymentMethod, customerId: customerId ?? null },
      })

      // 3. Procesar cada línea
      for (const detail of details) {
        const variant = await tx.variant.findUnique({
          where: { id: detail.variantId },
          include: { product: true },
        })
        if (!variant) throw new Error(`Variante ${detail.variantId} no encontrada`)

        const baseUnitsToDeduct = detail.quantity * variant.baseContentQty

        await tx.saleDetail.create({
          data: {
            saleId: newSale.id,
            variantId: detail.variantId,
            quantity: detail.quantity,
            unitPrice: detail.unitPrice,
          },
        })

        // Decrementar POOL del PRODUCTO
        const updatedProduct = await tx.product.update({
          where: { id: variant.productId },
          data: { stockInBaseUnits: { decrement: baseUnitsToDeduct } },
        })

        await tx.kardex.create({
          data: {
            variantId: detail.variantId,
            type: MovementType.OUT,
            quantity: baseUnitsToDeduct,
            balance: updatedProduct.stockInBaseUnits,
            description: `Venta: ${detail.quantity} ${variant.presentation} (-${baseUnitsToDeduct} ${variant.baseUnitName}) — ${isCredit ? `Crédito / Cliente #${customerId}` : 'Contado'}`,
            referenceId: newSale.id,
          },
        })
      }

      // 4. Actualizar deuda si es crédito
      if (isCredit && customerId) {
        await customerRepository.updateDebt(customerId, totalAmount)
      }

      return newSale
    })

    revalidatePath('/ventas')
    revalidatePath('/kardex')
    revalidatePath('/clientes')
    revalidatePath('/dashboard')
    revalidatePath('/productos')

    return { success: true, data: { saleId: sale.id } }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al registrar la venta'
    console.error('[registerSale]', error)
    return { success: false, error: msg }
  }
}

export async function getSales() {
  try {
    const data = await prisma.sale.findMany({
      include: {
        customer: true,
        details: {
          include: {
            variant: {
              select: {
                presentation: true,
                baseContentQty: true,
                baseUnitName: true,
                defaultPrice: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    })
    return { success: true, data }
  } catch {
    return { success: false, error: 'Error al obtener las ventas' }
  }
}
