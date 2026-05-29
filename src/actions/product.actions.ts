'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { productRepository } from '@/repositories/product.repository'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ProductSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
})

const VariantSchema = z.object({
  productId: z.coerce.number().int().positive(),
  presentation: z.string().min(1, 'La presentación es requerida'),
  baseContentQty: z.coerce.number().int().positive('La cantidad base debe ser positiva'),
  baseUnitName: z.string().min(1, 'La unidad base es requerida'),
  currentStock: z.coerce.number().int().min(0).optional().default(0),
})

// ─── Productos ────────────────────────────────────────────────────────────────

export async function getProducts() {
  try {
    const data = await productRepository.findAllWithVariants()
    return { success: true, data }
  } catch {
    return { success: false, error: 'Error al obtener los productos' }
  }
}

export async function createProduct(input: unknown) {
  const parsed = ProductSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  try {
    const data = await productRepository.create({ name: parsed.data.name })
    revalidatePath('/productos')
    return { success: true, data }
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') 
      ? 'Ya existe un producto con ese nombre' 
      : 'Error al crear el producto'
    return { success: false, error: msg }
  }
}

export async function updateProduct(id: number, input: unknown) {
  const parsed = ProductSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }
  try {
    const data = await productRepository.update(id, { name: parsed.data.name })
    revalidatePath('/productos')
    return { success: true, data }
  } catch {
    return { success: false, error: 'Error al actualizar el producto' }
  }
}

export async function deleteProduct(id: number) {
  try {
    await productRepository.delete(id)
    revalidatePath('/productos')
    return { success: true }
  } catch {
    return { success: false, error: 'No se puede eliminar: tiene variantes o movimientos asociados' }
  }
}

// ─── Variantes ────────────────────────────────────────────────────────────────

export async function createVariant(input: unknown) {
  const parsed = VariantSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  try {
    const data = await prisma.variant.create({
      data: {
        productId: parsed.data.productId,
        presentation: parsed.data.presentation,
        baseContentQty: parsed.data.baseContentQty,
        baseUnitName: parsed.data.baseUnitName,
        currentStock: parsed.data.currentStock ?? 0,
      },
    })
    revalidatePath('/productos')
    return { success: true, data }
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? 'Ya existe esa presentación para este producto'
      : 'Error al crear la variante'
    return { success: false, error: msg }
  }
}

export async function deleteVariant(id: number) {
  try {
    await prisma.variant.delete({ where: { id } })
    revalidatePath('/productos')
    return { success: true }
  } catch {
    return { success: false, error: 'No se puede eliminar: tiene movimientos o ventas asociadas' }
  }
}

// ─── Crear producto completo con variantes y stock calculado ──────────────────

type VariantInput = {
  presentation: string   // "Caja" | "Colosal" | "Sobres" | etc.
  baseContentQty: number // cuántas unidades base contiene (ej: Caja=36, Colosal=120, Sobre=1)
  baseUnitName: string   // "Sobres" | "Doypack" | "Bote"
  defaultPrice: number   // precio de venta de esa presentación
  stockQty: number       // cuántas de ESTA presentación tienes en físico
}

export async function createProductWithVariants(input: {
  name: string
  variants: VariantInput[]
}) {
  if (!input.name?.trim()) return { success: false, error: 'El nombre es requerido' }
  if (!input.variants?.length) return { success: false, error: 'Agrega al menos una variante' }

  try {
    // Calcular stock total en unidades base
    // Ej: 2 Colossales × 120 + 3 Cajas × 36 + 5 Sobres × 1 = 353 Sobres
    const totalStockInBaseUnits = input.variants.reduce(
      (sum, v) => sum + v.stockQty * v.baseContentQty,
      0
    )

    const product = await prisma.product.create({
      data: {
        name: input.name.trim(),
        stockInBaseUnits: totalStockInBaseUnits,
        variants: {
          create: input.variants.map((v) => ({
            presentation: v.presentation,
            baseContentQty: v.baseContentQty,
            baseUnitName: v.baseUnitName,
            defaultPrice: v.defaultPrice,
            currentStock: 0,
          })),
        },
      },
      include: { variants: true },
    })

    // Registrar en Kardex si hay stock inicial
    if (totalStockInBaseUnits > 0) {
      const firstVariant = product.variants[0]
      if (firstVariant) {
        await prisma.kardex.create({
          data: {
            variantId: firstVariant.id,
            type: 'ADJUST',
            quantity: totalStockInBaseUnits,
            balance: totalStockInBaseUnits,
            description: `Inventario inicial — ${totalStockInBaseUnits} ${firstVariant.baseUnitName} cargados al sistema`,
          },
        })
      }
    }

    revalidatePath('/productos')
    return { success: true, data: product, totalStockInBaseUnits }
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? 'Ya existe un producto con ese nombre'
      : 'Error al crear el producto'
    return { success: false, error: msg }
  }
}

// ─── Actualizar precio de una variante ───────────────────────────────────────

export async function updateVariantPrice(variantId: number, defaultPrice: number) {
  try {
    await prisma.variant.update({
      where: { id: variantId },
      data: { defaultPrice },
    })
    revalidatePath('/productos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar el precio' }
  }
}
