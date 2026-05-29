import { PrismaClient, MovementType } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Inventario inicial (en unidades base = sobres/doypack/bote) ───────────────
const INITIAL_STOCK: Record<string, number> = {
  'ANTARA':     1,
  'KOSMOS':     93,
  'KOSMOS JR':  72,
  'KOSMOS RED': 23,
  'LOTUS':      22,
  'NOX':        107,
  'NOX BLACK':  0,
  'SONIK':      0,
  'SUPERNOVA':  149,
  'VESTA':      0,
}

// ─── Catálogo de productos con variantes y precios de venta ───────────────────
const PRODUCTS = [
  {
    name: 'SUPERNOVA',
    variants: [
      { presentation: 'Caja',    baseContentQty: 36,  baseUnitName: 'Sobres', defaultPrice: 330  },
      { presentation: 'Sobres',  baseContentQty: 1,   baseUnitName: 'Sobres', defaultPrice: 10   },
      { presentation: 'Colosal', baseContentQty: 120, baseUnitName: 'Sobres', defaultPrice: 1040 },
    ],
  },
  {
    name: 'NOX',
    variants: [
      { presentation: 'Caja',    baseContentQty: 36,  baseUnitName: 'Sobres', defaultPrice: 330  },
      { presentation: 'Sobres',  baseContentQty: 1,   baseUnitName: 'Sobres', defaultPrice: 10   },
      { presentation: 'Colosal', baseContentQty: 120, baseUnitName: 'Sobres', defaultPrice: 1040 },
    ],
  },
  {
    name: 'KOSMOS',
    variants: [
      { presentation: 'Caja',    baseContentQty: 36,  baseUnitName: 'Sobres', defaultPrice: 330  },
      { presentation: 'Sobres',  baseContentQty: 1,   baseUnitName: 'Sobres', defaultPrice: 10   },
      { presentation: 'Colosal', baseContentQty: 120, baseUnitName: 'Sobres', defaultPrice: 1040 },
    ],
  },
  {
    name: 'KOSMOS JR',
    variants: [
      { presentation: 'Caja',   baseContentQty: 36, baseUnitName: 'Sobres', defaultPrice: 330 },
      { presentation: 'Sobres', baseContentQty: 1,  baseUnitName: 'Sobres', defaultPrice: 10  },
    ],
  },
  {
    name: 'ANTARA',
    variants: [
      { presentation: 'Fresa',    baseContentQty: 1, baseUnitName: 'Doypack', defaultPrice: 330 },
      { presentation: 'Vainilla', baseContentQty: 1, baseUnitName: 'Doypack', defaultPrice: 330 },
    ],
  },
  {
    name: 'SONIK',
    variants: [
      { presentation: 'Caja',   baseContentQty: 36, baseUnitName: 'Sobres', defaultPrice: 330 },
      { presentation: 'Sobres', baseContentQty: 1,  baseUnitName: 'Sobres', defaultPrice: 11  },
    ],
  },
  {
    name: 'NOX BLACK',
    variants: [
      { presentation: 'Caja',   baseContentQty: 36, baseUnitName: 'Sobres', defaultPrice: 330 },
      { presentation: 'Sobres', baseContentQty: 1,  baseUnitName: 'Sobres', defaultPrice: 10  },
    ],
  },
  {
    name: 'KOSMOS RED',
    variants: [
      { presentation: 'Caja',   baseContentQty: 36, baseUnitName: 'Sobres', defaultPrice: 330 },
      { presentation: 'Sobres', baseContentQty: 1,  baseUnitName: 'Sobres', defaultPrice: 15  },
    ],
  },
  {
    name: 'VESTA',
    variants: [
      { presentation: 'Bote', baseContentQty: 1, baseUnitName: 'Bote', defaultPrice: 330 },
    ],
  },
  {
    name: 'LOTUS',
    variants: [
      { presentation: 'Caja',   baseContentQty: 36, baseUnitName: 'Sobres', defaultPrice: 330 },
      { presentation: 'Sobres', baseContentQty: 1,  baseUnitName: 'Sobres', defaultPrice: 10  },
    ],
  },
]

async function main() {
  console.log('🌱 Iniciando seed de productos Kromasol...\n')

  for (const product of PRODUCTS) {
    const initialStock = INITIAL_STOCK[product.name] ?? 0

    // Upsert producto y ajustar stock
    const p = await prisma.product.upsert({
      where: { name: product.name },
      update: { stockInBaseUnits: initialStock },
      create: { name: product.name, stockInBaseUnits: initialStock },
    })

    // Upsert variantes con precio de venta
    for (const v of product.variants) {
      await prisma.variant.upsert({
        where: { productId_presentation: { productId: p.id, presentation: v.presentation } },
        update: { defaultPrice: v.defaultPrice, baseContentQty: v.baseContentQty, baseUnitName: v.baseUnitName },
        create: {
          productId: p.id,
          presentation: v.presentation,
          baseContentQty: v.baseContentQty,
          baseUnitName: v.baseUnitName,
          defaultPrice: v.defaultPrice,
          currentStock: 0,
        },
      })
    }

    // Registrar ajuste de inventario en Kardex (si hay stock inicial)
    if (initialStock > 0) {
      // Usar la primer variante del producto para el registro Kardex
      const firstVariant = await prisma.variant.findFirst({
        where: { productId: p.id },
        orderBy: { id: 'asc' },
      })
      if (firstVariant) {
        // Borrar kardex previo de ajuste para este producto (evitar duplicados al re-ejecutar seed)
        await prisma.kardex.deleteMany({
          where: { variantId: firstVariant.id, type: MovementType.ADJUST, description: { startsWith: 'Inventario inicial' } },
        })
        await prisma.kardex.create({
          data: {
            variantId: firstVariant.id,
            type: MovementType.ADJUST,
            quantity: initialStock,
            balance: initialStock,
            description: `Inventario inicial — ${initialStock} ${firstVariant.baseUnitName} cargados al sistema`,
          },
        })
      }
    }

    const unitLabel = product.variants[0]?.baseUnitName ?? 'u'
    const stock = initialStock > 0 ? `📦 ${initialStock} ${unitLabel}` : '⚪ Sin stock'
    console.log(`  ✅ ${p.name.padEnd(12)} — ${product.variants.length} variantes · ${stock}`)
  }

  const totals = await Promise.all([
    prisma.product.count(),
    prisma.variant.count(),
  ])

  console.log(`\n🎉 Seed completado: ${totals[0]} productos · ${totals[1]} variantes`)
  console.log('📊 Inventario cargado según datos proporcionados\n')
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
