import { prisma } from '@/lib/prisma'
import { MovementType } from '@prisma/client'

export const kardexRepository = {
  async findAll() {
    return prisma.kardex.findMany({
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 500,
    })
  },

  async findByVariant(variantId: number) {
    return prisma.kardex.findMany({
      where: { variantId },
      include: { variant: { include: { product: true } } },
      orderBy: { date: 'desc' },
    })
  },

  async createMovement(data: {
    variantId: number
    type: MovementType
    quantity: number
    balance: number
    description: string
    referenceId?: number
  }) {
    return prisma.kardex.create({ data })
  },
}
