'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Tipos ────────────────────────────────────────────────────────────────────

const GastoSchema = z.object({
  description: z.string().min(1, 'La descripción es requerida'),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  category: z.enum(['TRANSPORTE', 'SERVICIOS', 'PERSONAL', 'MARKETING', 'ALQUILER', 'OTROS']).default('OTROS'),
  notes: z.string().optional(),
  date: z.coerce.date().optional(),
})

// ─── Obtener resumen financiero ───────────────────────────────────────────────

export async function getResumenFinanciero() {
  try {
    const [config, gastos, ventas, compras, cuotasPagadas] = await Promise.all([
      prisma.configuracion.findUnique({ where: { id: 1 } }),
      // Solo gastos con monto POSITIVO (los negativos fueron un bug anterior)
      prisma.gasto.findMany({
        where: { amount: { gt: 0 } },
        orderBy: { date: 'desc' },
      }),
      prisma.sale.findMany({
        select: {
          id: true, totalAmount: true, isCredit: true, date: true,
          paymentMethod: true, customer: { select: { name: true } },
          details: {
            select: {
              quantity: true, unitPrice: true,
              variant: { select: { presentation: true, product: { select: { name: true } } } },
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.purchase.findMany({
        select: {
          id: true, totalCost: true, date: true, period: true,
          details: {
            select: {
              quantity: true, unitCost: true,
              variant: { select: { presentation: true, product: { select: { name: true } } } },
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      // Cuotas pagadas = ingresos de ventas a crédito cobradas
      prisma.cuota.findMany({
        where: { estado: 'PAGADA' },
        include: { sale: { include: { customer: { select: { name: true } } } } },
        orderBy: { fechaPago: 'desc' },
      }),
    ])

    const capitalInicial = config?.capitalInicial ?? 0
    const totalVentasContado = ventas
      .filter((v) => !v.isCredit)
      .reduce((s, v) => s + v.totalAmount, 0)
    const totalVentasCredito = ventas
      .filter((v) => v.isCredit)
      .reduce((s, v) => s + v.totalAmount, 0)
    const totalCuotasCobradas = cuotasPagadas.reduce((s, c) => s + c.monto, 0)
    const totalCompras = compras.reduce((s, c) => s + c.totalCost, 0)
    const totalGastos = gastos.reduce((s, g) => s + g.amount, 0)

    // Saldo = capital + ventas contado + cuotas cobradas − compras − gastos
    const saldoActual = capitalInicial + totalVentasContado + totalCuotasCobradas - totalCompras - totalGastos

    return {
      success: true,
      data: {
        saldoActual,
        capitalInicial,
        totalVentasContado,
        totalVentasCredito,
        totalCuotasCobradas,
        totalCompras,
        totalGastos,
        gastos,
        ventas,
        compras,
        cuotasPagadas,
      },
    }
  } catch (error) {
    console.error('[getResumenFinanciero]', error)
    return { success: false, error: 'Error al obtener el resumen financiero' }
  }
}

// ─── Actualizar capital inicial ───────────────────────────────────────────────

export async function updateCapitalInicial(amount: number) {
  try {
    if (isNaN(amount) || amount < 0) return { success: false, error: 'Monto inválido' }

    await prisma.configuracion.upsert({
      where: { id: 1 },
      update: { capitalInicial: amount },
      create: { id: 1, capitalInicial: amount },
    })

    revalidatePath('/caja')
    return { success: true }
  } catch (error) {
    console.error('[updateCapitalInicial]', error)
    return { success: false, error: 'Error al actualizar el capital' }
  }
}

// ─── Registrar gasto ──────────────────────────────────────────────────────────

export async function registerGasto(input: unknown) {
  const parsed = GastoSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos: ' + parsed.error.issues[0]?.message }

  try {
    const gasto = await prisma.gasto.create({
      data: {
        description: parsed.data.description,
        amount: parsed.data.amount,
        category: parsed.data.category,
        notes: parsed.data.notes ?? null,
        date: parsed.data.date ?? new Date(),
      },
    })

    revalidatePath('/caja')
    return { success: true, data: { gastoId: gasto.id } }
  } catch (error) {
    console.error('[registerGasto]', error)
    return { success: false, error: 'Error al registrar el gasto' }
  }
}

// ─── Eliminar gasto ───────────────────────────────────────────────────────────

export async function deleteGasto(id: number) {
  try {
    await prisma.gasto.delete({ where: { id } })
    revalidatePath('/caja')
    return { success: true }
  } catch (error) {
    console.error('[deleteGasto]', error)
    return { success: false, error: 'Error al eliminar el gasto' }
  }
}
