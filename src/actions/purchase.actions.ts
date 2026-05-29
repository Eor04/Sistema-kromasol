'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { MovementType } from '@prisma/client'

const PurchaseDetailSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.coerce.number().positive('El costo debe ser mayor a 0'),
})

const RegisterPurchaseSchema = z.object({
  period: z.string().min(1, 'El período es requerido').max(20),
  promoType: z.string().optional(),
  details: z.array(PurchaseDetailSchema).min(1, 'Debe agregar al menos un producto'),
})

export type RegisterPurchaseInput = z.infer<typeof RegisterPurchaseSchema>

/**
 * POOL UNIFICADO POR PRODUCTO:
 * El stock vive en Product.stockInBaseUnits.
 * Comprar 2 Cajas de SUPERNOVA (36 sobres c/u) → SUPERNOVA.stockInBaseUnits += 72
 */
export async function registerPurchase(
  input: RegisterPurchaseInput,
): Promise<{ success: true; data: { purchaseId: number } } | { success: false; error: string }> {
  const parsed = RegisterPurchaseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { period, promoType, details } = parsed.data
  const totalCost = details.reduce((sum, d) => sum + d.quantity * d.unitCost, 0)

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: { period, promoType: promoType || null, totalCost },
      })

      for (const detail of details) {
        const variant = await tx.variant.findUnique({
          where: { id: detail.variantId },
          include: { product: true },
        })
        if (!variant) throw new Error(`Variante ${detail.variantId} no encontrada`)

        // Unidades base a añadir (ej: 2 Cajas × 36 = 72 sobres)
        const baseUnitsToAdd = detail.quantity * variant.baseContentQty

        await tx.purchaseDetail.create({
          data: {
            purchaseId: newPurchase.id,
            variantId: detail.variantId,
            quantity: detail.quantity,
            unitCost: detail.unitCost,
          },
        })

        // Incrementar el POOL del PRODUCTO (no de la variante)
        const updatedProduct = await tx.product.update({
          where: { id: variant.productId },
          data: { stockInBaseUnits: { increment: baseUnitsToAdd } },
        })

        await tx.kardex.create({
          data: {
            variantId: detail.variantId,
            type: MovementType.IN,
            quantity: baseUnitsToAdd,
            balance: updatedProduct.stockInBaseUnits,
            description: `Compra: ${detail.quantity} ${variant.presentation} (+${baseUnitsToAdd} ${variant.baseUnitName}) — Período: ${period}${promoType ? ` | ${promoType}` : ''}`,
            referenceId: newPurchase.id,
          },
        })
      }

      return newPurchase
    })

    revalidatePath('/compras')
    revalidatePath('/kardex')
    revalidatePath('/dashboard')
    revalidatePath('/productos')

    return { success: true, data: { purchaseId: purchase.id } }
  } catch (error) {
    console.error('[registerPurchase]', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error al registrar la compra' }
  }
}

export async function getPurchases() {
  try {
    const data = await prisma.purchase.findMany({
      include: {
        details: {
          include: {
            variant: {
              select: {
                presentation: true,
                baseContentQty: true,
                baseUnitName: true,
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
    return { success: false, error: 'Error al obtener las compras' }
  }
}
