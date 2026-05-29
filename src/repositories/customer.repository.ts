import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const customerRepository = {
  async findAll() {
    return prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { sales: true } } },
    })
  },

  async findById(id: number) {
    return prisma.customer.findUnique({
      where: { id },
      include: { sales: { include: { details: true } } },
    })
  },

  async create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data })
  },

  async update(id: number, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data })
  },

  async updateDebt(id: number, debtDelta: number) {
    return prisma.customer.update({
      where: { id },
      data: { totalDebt: { increment: debtDelta } },
    })
  },

  async delete(id: number) {
    return prisma.customer.delete({ where: { id } })
  },
}
