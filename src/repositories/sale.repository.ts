import { prisma } from '@/lib/prisma'

export const saleRepository = {
  async findAll() {
    return prisma.sale.findMany({
      include: {
        customer: true,
        details: {
          include: { variant: { include: { product: true } } },
        },
      },
      orderBy: { date: 'desc' },
    })
  },

  async findById(id: number) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        details: { include: { variant: { include: { product: true } } } },
      },
    })
  },
}
