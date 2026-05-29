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
