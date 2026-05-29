'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronDown, ChevronRight, Package, Tag, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { createProduct, deleteProduct, createVariant, deleteVariant } from '@/actions/product.actions'

type Variant = {
  id: number
  presentation: string
  baseContentQty: number
  baseUnitName: string
  defaultPrice: number
}

type Product = {
  id: number
  name: string
  stockInBaseUnits: number
  imageUrl: string | null
  variants: Variant[]
}

type DialogMode = 'product' | 'variant' | null

export function ProductosClient({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUploadProductId, setPendingUploadProductId] = useState<number | null>(null)

  // Form state
  const [productName, setProductName] = useState('')
  const [vPresentation, setVPresentation] = useState('')
  const [vBaseQty, setVBaseQty] = useState('')
  const [vBaseUnit, setVBaseUnit] = useState('')
  const [vInitStock, setVInitStock] = useState('0')

  const openProductDialog = () => {
    setProductName('')
    setDialogMode('product')
  }

  const openVariantDialog = (productId: number) => {
    setSelectedProductId(productId)
    setVPresentation('')
    setVBaseQty('')
    setVBaseUnit('')
    setVInitStock('0')
    setDialogMode('variant')
  }

  const handleCreateProduct = () => {
    if (!productName.trim()) return toast.error('El nombre es requerido')
    startTransition(async () => {
      const result = await createProduct({ name: productName.trim() })
      if (result.success) {
        toast.success('Producto creado')
        setDialogMode(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleCreateVariant = () => {
    if (!vPresentation.trim() || !vBaseQty || !vBaseUnit.trim())
      return toast.error('Complete todos los campos requeridos')

    startTransition(async () => {
      const result = await createVariant({
        productId: selectedProductId!,
        presentation: vPresentation.trim(),
        baseContentQty: parseInt(vBaseQty),
        baseUnitName: vBaseUnit.trim(),
        currentStock: parseInt(vInitStock) || 0,
      })
      if (result.success) {
        toast.success('Variante creada')
        setDialogMode(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleDeleteProduct = (id: number) => {
    startTransition(async () => {
      const result = await deleteProduct(id)
      if (result.success) {
        toast.success('Producto eliminado')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleDeleteVariant = (id: number) => {
    startTransition(async () => {
      const result = await deleteVariant(id)
      if (result.success) {
        toast.success('Variante eliminada')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUploadProductId) return
    e.target.value = ''

    setUploadingId(pendingUploadProductId)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('productId', String(pendingUploadProductId))

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        toast.success('Imagen actualizada correctamente')
        router.refresh()
      } else {
        toast.error(data.error ?? 'Error al subir la imagen')
      }
    } catch {
      toast.error('Error de red al subir la imagen')
    } finally {
      setUploadingId(null)
      setPendingUploadProductId(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Input oculto para subir imagen */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleImageUpload}
      />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Productos</h1>
          <p className="text-slate-400 mt-1">Catálogo de productos y variantes Kromasol</p>
        </div>
        <Button
          id="btn-new-product"
          onClick={openProductDialog}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Products list */}
      <div className="space-y-4">
        {initialProducts.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="text-center py-16 text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No hay productos registrados</p>
              <p className="text-sm">Haz clic en "Nuevo Producto" para comenzar</p>
            </CardContent>
          </Card>
        ) : (
          initialProducts.map((product) => (
            <Card key={product.id} className="bg-slate-900 border-slate-800 overflow-hidden">
              {/* Product header */}
              <CardHeader
                className="cursor-pointer hover:bg-slate-800/50 transition-colors py-4"
                onClick={() => setExpanded(expanded === product.id ? null : product.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expanded === product.id ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}

                    {/* Thumbnail de imagen */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-700 shrink-0 relative">
                      {product.imageUrl ? (
                        <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="40px" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-slate-500" />
                        </div>
                      )}
                    </div>

                    <CardTitle className="text-white text-base">{product.name}</CardTitle>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
                      {product.variants.length} variantes
                    </Badge>
                    {/* Stock total */}
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        product.stockInBaseUnits === 0
                          ? 'border-rose-500 text-rose-400'
                          : product.stockInBaseUnits <= 20
                          ? 'border-amber-500 text-amber-400'
                          : 'border-emerald-600 text-emerald-400'
                      }`}
                    >
                      {product.stockInBaseUnits === 0
                        ? 'Sin stock'
                        : `${product.stockInBaseUnits} ${product.variants[0]?.baseUnitName ?? 'u'}`}
                    </Badge>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Botón subir imagen */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={uploadingId === product.id}
                      onClick={() => {
                        setPendingUploadProductId(product.id)
                        fileInputRef.current?.click()
                      }}
                      className="border-blue-600 text-blue-400 hover:bg-blue-600/10 text-xs"
                      title="Cambiar imagen del producto"
                    >
                      <Camera className="h-3 w-3 mr-1" />
                      {uploadingId === product.id ? 'Subiendo...' : 'Imagen'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/10 text-xs"
                      onClick={() => openVariantDialog(product.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Variante
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteProduct(product.id)}
                      disabled={isPending}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 h-8 w-8"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Variants */}
              {expanded === product.id && (
                <CardContent className="pt-0 pb-4">
                  <div className="ml-7 border-l-2 border-slate-800 pl-4 space-y-2">
                    {product.variants.length === 0 ? (
                      <p className="text-slate-500 text-sm py-2">Sin variantes — agrega una con el botón</p>
                    ) : (
                      product.variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                        >
                          <div className="flex items-center gap-3">
                            <Tag className="h-4 w-4 text-blue-400 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-white">{v.presentation}</p>
                              <p className="text-xs text-slate-400">
                                {v.baseContentQty} {v.baseUnitName} por unidad
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              {/* Precio sugerido de venta */}
                              <p className="text-sm font-semibold text-emerald-400">
                                Bs. {v.defaultPrice.toLocaleString('es-VE')}
                              </p>
                              {/* Equivalencia en presentaciones */}
                              {v.baseContentQty > 1 && (
                                <p className="text-xs text-slate-500">
                                  ≈ {Math.floor(product.stockInBaseUnits / v.baseContentQty)} {v.presentation}{Math.floor(product.stockInBaseUnits / v.baseContentQty) !== 1 ? 's' : ''} disponibles
                                  {product.stockInBaseUnits % v.baseContentQty > 0 && ` + ${product.stockInBaseUnits % v.baseContentQty} sueltos`}
                                </p>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteVariant(v.id)}
                              disabled={isPending}
                              className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 h-7 w-7"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Dialog: Nuevo Producto */}
      <Dialog open={dialogMode === 'product'} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Nuevo Producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Nombre del Producto *</Label>
              <Input
                id="product-name-input"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="ej. Aceite de Coco Kromasol"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)} className="text-slate-400">
              Cancelar
            </Button>
            <Button
              id="save-product"
              onClick={handleCreateProduct}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {isPending ? 'Guardando...' : 'Crear Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nueva Variante */}
      <Dialog open={dialogMode === 'variant'} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Nueva Variante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Presentación *</Label>
              <Input
                id="variant-presentation"
                value={vPresentation}
                onChange={(e) => setVPresentation(e.target.value)}
                placeholder="ej. Frasco 250ml"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Contenido base *</Label>
                <Input
                  id="variant-base-qty"
                  type="number"
                  min="1"
                  value={vBaseQty}
                  onChange={(e) => setVBaseQty(e.target.value)}
                  placeholder="250"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Unidad base *</Label>
                <Input
                  id="variant-base-unit"
                  value={vBaseUnit}
                  onChange={(e) => setVBaseUnit(e.target.value)}
                  placeholder="ml / gr / uds"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Stock inicial</Label>
              <Input
                id="variant-init-stock"
                type="number"
                min="0"
                value={vInitStock}
                onChange={(e) => setVInitStock(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)} className="text-slate-400">
              Cancelar
            </Button>
            <Button
              id="save-variant"
              onClick={handleCreateVariant}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {isPending ? 'Guardando...' : 'Crear Variante'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
