'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, ShoppingCart, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { registerPurchase } from '@/actions/purchase.actions'
import { formatCurrency } from '@/lib/utils'

type Variant = {
  id: number
  presentation: string
  baseContentQty: number
  baseUnitName: string
  currentStock: number
  product: { id: number; name: string }
}

type DetailLine = {
  variantId: string
  quantity: string
  unitCost: string
}

const emptyLine = (): DetailLine => ({ variantId: '', quantity: '', unitCost: '' })

interface PurchaseFormProps {
  variants: Variant[]
  onSuccess: () => void
}

export function PurchaseForm({ variants, onSuccess }: PurchaseFormProps) {
  const [period, setPeriod] = useState('')
  const [promoType, setPromoType] = useState('')
  const [lines, setLines] = useState<DetailLine[]>([emptyLine()])
  const [isPending, startTransition] = useTransition()

  const addLine = () => setLines((prev) => [...prev, emptyLine()])

  const removeLine = (idx: number) =>
    setLines((prev) => prev.filter((_, i) => i !== idx))

  const updateLine = (idx: number, field: keyof DetailLine, value: string) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))

  const total = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0
    const cost = parseFloat(l.unitCost) || 0
    return sum + qty * cost
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const details = lines
      .filter((l) => l.variantId && l.quantity && l.unitCost)
      .map((l) => ({
        variantId: parseInt(l.variantId),
        quantity: parseInt(l.quantity),
        unitCost: parseFloat(l.unitCost),
      }))

    if (!period.trim()) return toast.error('El período es requerido')
    if (details.length === 0) return toast.error('Agregue al menos un producto')

    startTransition(async () => {
      const result = await registerPurchase({ period, promoType: promoType || undefined, details })
      if (result.success) {
        toast.success(`Compra #${result.data.purchaseId} registrada correctamente`)
        setPeriod('')
        setPromoType('')
        setLines([emptyLine()])
        onSuccess()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-emerald-400" />
          Registrar Nueva Compra
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Encabezado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Período *</Label>
              <Input
                id="purchase-period"
                placeholder="ej. Mayo-2025"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo de Promoción</Label>
              <Input
                id="purchase-promo"
                placeholder="ej. Descuento por volumen"
                value={promoType}
                onChange={(e) => setPromoType(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Líneas de detalle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Productos *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
                className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/10"
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar línea
              </Button>
            </div>

            {/* Cabecera de tabla */}
            <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 px-1 hidden sm:grid">
              <span className="col-span-5">Variante</span>
              <span className="col-span-3">Cantidad</span>
              <span className="col-span-3">Costo Unitario</span>
              <span className="col-span-1" />
            </div>

            {lines.map((line, idx) => {
              const selectedVariant = variants.find((v) => String(v.id) === line.variantId)
              const qtyNum = parseInt(line.quantity) || 0
              const baseUnitsToAdd = selectedVariant ? qtyNum * selectedVariant.baseContentQty : 0

              return (
                <div key={idx} className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Variante */}
                    <div className="col-span-12 sm:col-span-5">
                      <Select
                        value={line.variantId}
                        onValueChange={(v) => updateLine(idx, 'variantId', v ?? '')}
                      >
                        <SelectTrigger
                          id={`purchase-variant-${idx}`}
                          className="bg-slate-800 border-slate-700 text-white"
                        >
                          <SelectValue placeholder="Seleccionar variante..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {variants.map((v) => {
                            const stockInPresentations = Math.floor(v.currentStock / v.baseContentQty)
                            return (
                              <SelectItem
                                key={v.id}
                                value={String(v.id)}
                                className="text-white focus:bg-slate-700"
                              >
                                <span className="font-medium">{v.product.name}</span>
                                <span className="text-slate-400"> — {v.presentation}</span>
                                {v.baseContentQty > 1 && (
                                  <span className="text-slate-500 text-xs ml-1">({v.baseContentQty} {v.baseUnitName}/u)</span>
                                )}
                                <span className="text-emerald-400 text-xs ml-2">
                                  stock: {v.currentStock} {v.baseUnitName}
                                  {v.baseContentQty > 1 && ` (≈${stockInPresentations} ${v.presentation}s)`}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cantidad */}
                    <div className="col-span-5 sm:col-span-3">
                      <Input
                        id={`purchase-qty-${idx}`}
                        type="number"
                        min="1"
                        placeholder="Cantidad"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>

                    {/* Costo */}
                    <div className="col-span-5 sm:col-span-3">
                      <Input
                        id={`purchase-cost-${idx}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="$ Costo"
                        value={line.unitCost}
                        onChange={(e) => updateLine(idx, 'unitCost', e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>

                    {/* Eliminar */}
                    <div className="col-span-2 sm:col-span-1 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Info de unidades base que se agregarán al stock */}
                  {selectedVariant && qtyNum > 0 && (
                    <div className="ml-1 flex items-center gap-2">
                      <Package className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400">
                        {qtyNum} {selectedVariant.presentation}
                        {selectedVariant.baseContentQty > 1 && (
                          <> = <strong>+{baseUnitsToAdd} {selectedVariant.baseUnitName}</strong> que se agregarán al inventario</>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Total y submit */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div>
              <p className="text-sm text-slate-400">Total calculado</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(total)}</p>
            </div>
            <Button
              id="submit-purchase"
              type="submit"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-8"
            >
              {isPending ? 'Registrando...' : 'Registrar Compra'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
