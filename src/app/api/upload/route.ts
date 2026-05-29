import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const productId = formData.get('productId') as string

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    if (!productId) return NextResponse.json({ error: 'productId requerido' }, { status: 400 })

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Use JPG, PNG o WebP.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Asegurar que el directorio existe
    const dir = join(process.cwd(), 'public', 'products')
    await mkdir(dir, { recursive: true })

    // Nombre del archivo basado en productId
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const filename = `product-${productId}.${ext}`
    const filepath = join(dir, filename)

    await writeFile(filepath, buffer)

    const imageUrl = `/products/${filename}`

    // Actualizar imageUrl en la BD
    await prisma.product.update({
      where: { id: parseInt(productId) },
      data: { imageUrl },
    })

    revalidatePath('/productos')
    revalidatePath('/ventas')

    return NextResponse.json({ success: true, imageUrl })
  } catch (error) {
    console.error('[upload] Error:', error)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
