import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type ProductWithVariants = Prisma.ProductGetPayload<{
  include: { variants: true }
}>

export const productRepository = {
  async findAll() {
    return prisma.product.findMany({ orderBy: { name: 'asc' } })
  },

  async findAllWithVariants(): Promise<ProductWithVariants[]> {
    return prisma.product.findMany({
      include: {
        variants: {
          orderBy: { baseContentQty: 'desc' }, // Cajas primero, luego Sobres
        },
      },
      orderBy: { name: 'asc' },
    })
  },

  async findById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    })
  },

  async create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({ data })
  },

  async update(id: number, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data })
  },

  async delete(id: number) {
    return prisma.product.delete({ where: { id } })
  },

  async createVariant(data: Prisma.VariantCreateInput) {
    return prisma.variant.create({ data })
  },

  async updateVariant(id: number, data: Prisma.VariantUpdateInput) {
    return prisma.variant.update({ where: { id }, data })
  },

  async deleteVariant(id: number) {
    return prisma.variant.delete({ where: { id } })
  },

  async findAllVariants() {
    return prisma.variant.findMany({
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    })
  },
}
