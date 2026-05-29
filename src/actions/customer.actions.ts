'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { customerRepository } from '@/repositories/customer.repository'
import { prisma } from '@/lib/prisma'

// ─── Schema ───────────────────────────────────────────────────────────────────

const CustomerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  phone: z.string().max(20).optional().or(z.literal('')),
})

// ─── Actions básicas ─────────────────────────────────────────────────────────

export async function getCustomers() {
  try {
    const data = await customerRepository.findAll()
    return { success: true, data }
  } catch {
    return { success: false, error: 'Error al obtener los clientes' }
  }
}

export async function createCustomer(input: unknown) {
  const parsed = CustomerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  try {
    const data = await customerRepository.create({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
    })
    revalidatePath('/clientes')
    return { success: true, data }
  } catch {
    return { success: false, error: 'Error al crear el cliente' }
  }
}

export async function updateCustomer(id: number, input: unknown) {
  const parsed = CustomerSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }
  try {
    const data = await customerRepository.update(id, {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
    })
    revalidatePath('/clientes')
    return { success: true, data }
  } catch {
    return { success: false, error: 'Error al actualizar el cliente' }
  }
}

export async function deleteCustomer(id: number) {
  try {
    await customerRepository.delete(id)
    revalidatePath('/clientes')
    return { success: true }
  } catch {
    return { success: false, error: 'No se puede eliminar: tiene ventas asociadas' }
  }
}

// ─── Obtener detalle de ventas a crédito de un cliente ────────────────────────

export async function getClienteCreditos(customerId: number) {
  try {
    const sales = await prisma.sale.findMany({
      where: { customerId, isCredit: true },
      include: {
        cuotas: { orderBy: { numeroCuota: 'asc' } },
        details: {
          include: { variant: { include: { product: true } } },
        },
      },
      orderBy: { date: 'desc' },
    })
    return { success: true, data: sales }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Error al obtener créditos' }
  }
}

// ─── Registrar cuotas para una venta a crédito ───────────────────────────────

export async function registrarCuotas(saleId: number, cuotas: { numeroCuota: number; monto: number }[]) {
  try {
    // Borrar cuotas existentes pendientes para no duplicar
    await prisma.cuota.deleteMany({ where: { saleId, estado: 'PENDIENTE' } })

    await prisma.cuota.createMany({
      data: cuotas.map((c) => ({
        saleId,
        numeroCuota: c.numeroCuota,
        monto: c.monto,
        estado: 'PENDIENTE',
      })),
    })

    revalidatePath('/clientes')
    revalidatePath('/caja')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Error al registrar cuotas' }
  }
}

// ─── Confirmar pago de una cuota ─────────────────────────────────────────────

export async function confirmarCuota(cuotaId: number) {
  try {
    const cuota = await prisma.cuota.update({
      where: { id: cuotaId },
      data: { estado: 'PAGADA', fechaPago: new Date() },
      include: { sale: { include: { customer: true } } },
    })

    // Reducir la deuda del cliente por el monto de la cuota
    if (cuota.sale.customerId) {
      await prisma.customer.update({
        where: { id: cuota.sale.customerId },
        data: { totalDebt: { decrement: cuota.monto } },
      })
    }

    revalidatePath('/clientes')
    revalidatePath('/caja')
    return { success: true, monto: cuota.monto }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Error al confirmar la cuota' }
  }
}

// ─── Pagar deuda total de golpe ───────────────────────────────────────────────

export async function pagarDeudaTotal(customerId: number) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) return { success: false, error: 'Cliente no encontrado' }

    const deuda = customer.totalDebt

    // Marcar todas las cuotas pendientes como pagadas
    await prisma.cuota.updateMany({
      where: { sale: { customerId }, estado: 'PENDIENTE' },
      data: { estado: 'PAGADA', fechaPago: new Date() },
    })

    // Saldar deuda del cliente
    await prisma.customer.update({
      where: { id: customerId },
      data: { totalDebt: 0 },
    })

    revalidatePath('/clientes')
    revalidatePath('/caja')
    return { success: true, montoPagado: deuda }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Error al registrar el pago' }
  }
}
