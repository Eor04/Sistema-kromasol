'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Trash2, ChevronDown, ChevronRight, Package,
  Tag, Camera, Calculator, Info, Pencil, Check, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  createProductWithVariants, deleteProduct, deleteVariant, updateVariantPrice,
} from '@/actions/product.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// Presentaciones comunes predefinidas
const PRESETS = [
  { label: 'Colosal', baseContentQty: 120, baseUnitName: 'Sobres' },
  { label: 'Caja',    baseContentQty: 36,  baseUnitName: 'Sobres' },
  { label: 'Sobre',   baseContentQty: 1,   baseUnitName: 'Sobres' },
  { label: 'Doypack', baseContentQty: 1,   baseUnitName: 'Doypack' },
  { label: 'Bote',    baseContentQty: 1,   baseUnitName: 'Bote' },
]

type VariantRow = {
  id: string           // key único local
  presentation: string
  baseContentQty: number
  baseUnitName: string
  defaultPrice: number
  stockQty: number     // cuántas de ESTA presentación tienes físicamente
}

function newRow(preset?: typeof PRESETS[0]): VariantRow {
  return {
    id: Math.random().toString(36).slice(2),
    presentation: preset?.label ?? '',
    baseContentQty: preset?.baseContentQty ?? 1,
    baseUnitName: preset?.baseUnitName ?? 'Sobres',
    defaultPrice: 0,
    stockQty: 0,
  }
}

// ─── ProductosClient ──────────────────────────────────────────────────────────

export function ProductosClient({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUploadProductId, setPendingUploadProductId] = useState<number | null>(null)

  // Edición inline de precio
  const [editingPrice, setEditingPrice] = useState<number | null>(null)
  const [editPriceValue, setEditPriceValue] = useState('')

  // ── Estado del formulario de nuevo producto ──
  const [productName, setProductName] = useState('')
  const [variants, setVariants] = useState<VariantRow[]>([newRow(PRESETS[1])]) // empieza con Caja

  // ── Cálculo live de stock total en unidades base ──
  const totalBase = variants.reduce((sum, v) => sum + (v.stockQty || 0) * v.baseContentQty, 0)
  const baseUnit = variants[0]?.baseUnitName ?? 'u'

  // ── Helpers de variantes en el form ──
  const addPreset = (preset: typeof PRESETS[0]) => {
    // Si ya existe esa presentación, no duplicar
    if (variants.some((v) => v.presentation.toLowerCase() === preset.label.toLowerCase())) {
      toast.error(`Ya agregaste "${preset.label}"`)
      return
    }
    setVariants((prev) => [...prev, newRow(preset)])
  }

  const updateRow = (id: string, field: keyof VariantRow, value: string | number) => {
    setVariants((prev) => prev.map((v) => v.id === id ? { ...v, [field]: value } : v))
  }

  const removeRow = (id: string) => {
    if (variants.length === 1) return toast.error('Debe haber al menos una variante')
    setVariants((prev) => prev.filter((v) => v.id !== id))
  }

  const openDialog = () => {
    setProductName('')
    setVariants([newRow(PRESETS[1])])
    setDialogOpen(true)
  }

  // ── Crear producto ──
  const handleCreate = () => {
    if (!productName.trim()) return toast.error('El nombre del producto es requerido')
    for (const v of variants) {
      if (!v.presentation.trim()) return toast.error('Completa el nombre de cada variante')
      if (v.baseContentQty < 1) return toast.error('El contenido base debe ser ≥ 1')
      if (v.defaultPrice < 0) return toast.error('El precio no puede ser negativo')
    }
    startTransition(async () => {
      const result = await createProductWithVariants({ name: productName.trim(), variants })
      if (result.success) {
        toast.success(
          `✅ ${productName} creado · ${result.totalStockInBaseUnits} ${baseUnit} en inventario`
        )
        setDialogOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  // ── Eliminar producto ──
  const handleDeleteProduct = (id: number) => {
    startTransition(async () => {
      const result = await deleteProduct(id)
      if (result.success) { toast.success('Producto eliminado'); router.refresh() }
      else toast.error(result.error)
    })
  }

  // ── Eliminar variante ──
  const handleDeleteVariant = (id: number) => {
    startTransition(async () => {
      const result = await deleteVariant(id)
      if (result.success) { toast.success('Variante eliminada'); router.refresh() }
      else toast.error(result.error)
    })
  }

  // ── Editar precio inline ──
  const savePrice = (variantId: number) => {
    const val = parseFloat(editPriceValue)
    if (isNaN(val) || val < 0) return toast.error('Precio inválido')
    startTransition(async () => {
      const result = await updateVariantPrice(variantId, val)
      if (result.success) { toast.success('Precio actualizado'); setEditingPrice(null); router.refresh() }
      else toast.error(result.error)
    })
  }

  // ── Subir imagen ──
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
      if (data.success) { toast.success('Imagen actualizada'); router.refresh() }
      else toast.error(data.error ?? 'Error al subir la imagen')
    } catch { toast.error('Error de red') }
    finally { setUploadingId(null); setPendingUploadProductId(null) }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden" onChange={handleImageUpload} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Productos</h1>
          <p className="text-slate-400 mt-1">Catálogo de productos y variantes Kromasol</p>
        </div>
        <Button id="btn-new-product" onClick={openDialog} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {initialProducts.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="text-center py-16 text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No hay productos registrados</p>
              <p className="text-sm">Haz clic en &quot;Nuevo Producto&quot; para comenzar</p>
            </CardContent>
          </Card>
        ) : (
          initialProducts.map((product) => (
            <Card key={product.id} className="bg-slate-900 border-slate-800 overflow-hidden">
              {/* Header del producto */}
              <CardHeader
                className="cursor-pointer hover:bg-slate-800/50 transition-colors py-4"
                onClick={() => setExpanded(expanded === product.id ? null : product.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expanded === product.id
                      ? <ChevronDown className="h-4 w-4 text-slate-400" />
                      : <ChevronRight className="h-4 w-4 text-slate-400" />}

                    {/* Thumbnail */}
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
                    <Badge variant="outline" className={`text-xs ${
                      product.stockInBaseUnits === 0 ? 'border-rose-500 text-rose-400'
                        : product.stockInBaseUnits <= 20 ? 'border-amber-500 text-amber-400'
                        : 'border-emerald-600 text-emerald-400'
                    }`}>
                      {product.stockInBaseUnits === 0
                        ? 'Sin stock'
                        : `${product.stockInBaseUnits} ${product.variants[0]?.baseUnitName ?? 'u'}`}
                    </Badge>
                  </div>

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" disabled={uploadingId === product.id}
                      onClick={() => { setPendingUploadProductId(product.id); fileInputRef.current?.click() }}
                      className="border-blue-600 text-blue-400 hover:bg-blue-600/10 text-xs">
                      <Camera className="h-3 w-3 mr-1" />
                      {uploadingId === product.id ? 'Subiendo...' : 'Imagen'}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(product.id)}
                      disabled={isPending}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 h-8 w-8">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Variantes expandidas */}
              {expanded === product.id && (
                <CardContent className="pt-0 pb-4">
                  <div className="ml-7 border-l-2 border-slate-800 pl-4 space-y-2">
                    {product.variants.length === 0 ? (
                      <p className="text-slate-500 text-sm py-2">Sin variantes</p>
                    ) : (
                      product.variants.map((v) => {
                        const disponibles = v.baseContentQty > 1
                          ? Math.floor(product.stockInBaseUnits / v.baseContentQty)
                          : null
                        const sueltos = v.baseContentQty > 1
                          ? product.stockInBaseUnits % v.baseContentQty
                          : null

                        return (
                          <div key={v.id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center gap-3">
                              <Tag className="h-4 w-4 text-blue-400 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-white">{v.presentation}</p>
                                <p className="text-xs text-slate-400">
                                  {v.baseContentQty} {v.baseUnitName} por unidad
                                </p>
                                {disponibles !== null && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    ≈ <span className="text-slate-300 font-medium">{disponibles}</span> {v.presentation.toLowerCase()}{disponibles !== 1 ? 's' : ''} disponibles
                                    {sueltos ? ` + ${sueltos} sueltos` : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {/* Precio editable inline */}
                              {editingPrice === v.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 text-xs">Bs.</span>
                                  <Input
                                    type="number" min="0" step="0.01"
                                    value={editPriceValue}
                                    onChange={(e) => setEditPriceValue(e.target.value)}
                                    className="w-20 h-7 text-xs bg-slate-700 border-slate-600 text-white px-2"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') savePrice(v.id); if (e.key === 'Escape') setEditingPrice(null) }}
                                  />
                                  <button onClick={() => savePrice(v.id)} className="text-emerald-400 hover:text-emerald-300">
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => setEditingPrice(null)} className="text-slate-500 hover:text-slate-300">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingPrice(v.id); setEditPriceValue(String(v.defaultPrice)) }}
                                  className="flex items-center gap-1 group"
                                  title="Clic para editar precio"
                                >
                                  <span className="text-sm font-semibold text-emerald-400">
                                    Bs. {v.defaultPrice.toLocaleString('es-VE')}
                                  </span>
                                  <Pencil className="h-2.5 w-2.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                </button>
                              )}

                              <Button size="icon" variant="ghost" onClick={() => handleDeleteVariant(v.id)}
                                disabled={isPending}
                                className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 h-7 w-7">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* ── Dialog: Nuevo Producto con asistente de stock ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Calculator className="h-5 w-5 text-emerald-400" />
              Nuevo Producto
            </DialogTitle>
            <p className="text-slate-400 text-sm">
              Agrega las presentaciones que tienes (Caja, Colosal, Sobres...) y el sistema calculará el stock total automáticamente.
            </p>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Nombre */}
            <div className="space-y-2">
              <Label className="text-slate-300 font-medium">Nombre del producto *</Label>
              <Input
                id="product-name-input"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="ej. LOTUS, NOX PLUS..."
                className="bg-slate-800 border-slate-700 text-white uppercase placeholder:normal-case"
              />
            </div>

            {/* Accesos rápidos */}
            <div className="space-y-2">
              <Label className="text-slate-400 text-xs uppercase tracking-wider">Agregar presentación rápida</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p.label} onClick={() => addPreset(p)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg border border-slate-600 hover:border-slate-500 transition-all flex items-center gap-1">
                    <Plus className="h-3 w-3" /> {p.label}
                    <span className="text-slate-400">({p.baseContentQty} {p.baseUnitName})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filas de variantes */}
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 px-1">
                <span className="col-span-3">Presentación</span>
                <span className="col-span-2 text-center">Unidades/paquete</span>
                <span className="col-span-2">Unidad base</span>
                <span className="col-span-2 text-center">Precio venta (Bs.)</span>
                <span className="col-span-2 text-center">Stock físico</span>
                <span className="col-span-1" />
              </div>

              {variants.map((v, idx) => (
                <div key={v.id} className="grid grid-cols-12 gap-2 items-center bg-slate-800/50 rounded-xl px-3 py-3 border border-slate-700/50">
                  {/* Presentación */}
                  <div className="col-span-3">
                    <Input
                      value={v.presentation}
                      onChange={(e) => updateRow(v.id, 'presentation', e.target.value)}
                      placeholder="Caja / Colosal / Sobre"
                      className="bg-slate-700 border-slate-600 text-white h-8 text-sm"
                    />
                  </div>

                  {/* Contenido base */}
                  <div className="col-span-2">
                    <Input
                      type="number" min="1" value={v.baseContentQty}
                      onChange={(e) => updateRow(v.id, 'baseContentQty', parseInt(e.target.value) || 1)}
                      className="bg-slate-700 border-slate-600 text-white h-8 text-sm text-center"
                      title="Cuántas unidades base contiene (ej: Caja = 36 sobres)"
                    />
                  </div>

                  {/* Unidad base */}
                  <div className="col-span-2">
                    <Input
                      value={v.baseUnitName}
                      onChange={(e) => updateRow(v.id, 'baseUnitName', e.target.value)}
                      placeholder="Sobres"
                      className="bg-slate-700 border-slate-600 text-white h-8 text-sm"
                    />
                  </div>

                  {/* Precio */}
                  <div className="col-span-2">
                    <Input
                      type="number" min="0" step="0.01" value={v.defaultPrice || ''}
                      onChange={(e) => updateRow(v.id, 'defaultPrice', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="bg-slate-700 border-slate-600 text-white h-8 text-sm text-center"
                    />
                  </div>

                  {/* Stock físico */}
                  <div className="col-span-2">
                    <Input
                      type="number" min="0" value={v.stockQty || ''}
                      onChange={(e) => updateRow(v.id, 'stockQty', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className={`bg-slate-700 border-slate-600 text-white h-8 text-sm text-center ${v.stockQty > 0 ? 'border-emerald-700/50 text-emerald-300' : ''}`}
                      title="¿Cuántas tienes físicamente de esta presentación?"
                    />
                  </div>

                  {/* Eliminar fila */}
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => removeRow(v.id)}
                      className="text-slate-600 hover:text-rose-400 transition-colors"
                      disabled={variants.length === 1}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Sub-fila: cálculo parcial */}
                  {v.stockQty > 0 && (
                    <div className="col-span-12 text-xs text-slate-400 px-1 -mt-1">
                      {v.stockQty} {v.presentation} × {v.baseContentQty} {v.baseUnitName} =
                      <span className="text-emerald-400 font-semibold ml-1">
                        {v.stockQty * v.baseContentQty} {v.baseUnitName}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              <button onClick={() => setVariants((p) => [...p, newRow()])}
                className="w-full py-2 border border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-slate-300 hover:border-slate-500 text-xs transition-all flex items-center justify-center gap-1">
                <Plus className="h-3 w-3" /> Agregar variante personalizada
              </button>
            </div>

            {/* ── Resumen de stock calculado ── */}
            <div className={`rounded-xl border p-4 transition-all ${
              totalBase > 0
                ? 'bg-emerald-950/30 border-emerald-700/40'
                : 'bg-slate-800/30 border-slate-700/40'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className={`h-4 w-4 ${totalBase > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-sm font-medium text-slate-300">Stock total calculado</span>
                </div>
                <span className={`text-2xl font-black ${totalBase > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {totalBase} <span className="text-base font-medium">{baseUnit}</span>
                </span>
              </div>

              {/* Desglose */}
              {variants.filter((v) => v.stockQty > 0).length > 1 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-0.5">
                  {variants.filter((v) => v.stockQty > 0).map((v) => (
                    <div key={v.id} className="flex justify-between text-xs text-slate-500">
                      <span>{v.stockQty} {v.presentation}(s) × {v.baseContentQty}</span>
                      <span className="text-slate-400">= {v.stockQty * v.baseContentQty} {v.baseUnitName}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-1.5 mt-3">
                <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500">
                  El sistema guarda el stock en {baseUnit} (unidad mínima). Al vender una <strong className="text-slate-400">Caja</strong> descuenta
                  {' '}{variants.find(v => v.presentation.toLowerCase() === 'caja')?.baseContentQty ?? 36} {baseUnit}, al vender un <strong className="text-slate-400">Colosal</strong> descuenta
                  {' '}{variants.find(v => v.presentation.toLowerCase() === 'colosal')?.baseContentQty ?? 120} {baseUnit}, etc.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-slate-400">Cancelar</Button>
            <Button
              id="save-product"
              onClick={handleCreate}
              disabled={isPending || !productName.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Crear Producto {totalBase > 0 && `· ${totalBase} ${baseUnit}`}
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
