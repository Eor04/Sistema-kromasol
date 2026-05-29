import { prisma } from '@/lib/prisma'

export const purchaseRepository = {
  async findAll() {
    return prisma.purchase.findMany({
      include: {
        details: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    })
  },

  async findById(id: number) {
    return prisma.purchase.findUnique({
      where: { id },
      include: {
        details: {
          include: { variant: { include: { product: true } } },
        },
      },
    })
  },
}
