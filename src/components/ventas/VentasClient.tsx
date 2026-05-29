'use client'

import React, { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ShoppingCart, Trash2, Plus, Minus, History, Search,
  Banknote, QrCode, Building2, CreditCard, User, X, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { registerSale } from '@/actions/sale.actions'
import { formatCurrency, formatDate } from '@/lib/utils'

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

type Customer = { id: number; name: string }

type SaleDetail = {
  id: number
  quantity: number
  unitPrice: number
  variant: {
    presentation: string
    baseContentQty: number
    baseUnitName: string
    product: { name: string }
  }
}

type Sale = {
  id: number
  date: Date
  totalAmount: number
  isCredit: boolean
  paymentMethod: string
  customer: Customer | null
  details: SaleDetail[]
}

type CartItem = {
  cartKey: string
  variantId: number
  productName: string
  productImage: string | null
  presentation: string
  baseContentQty: number
  baseUnitName: string
  quantity: number
  unitPrice: number
  stockInBaseUnits: number
}

type PaymentMethod = 'EFECTIVO' | 'QR' | 'TRANSFERENCIA'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADIENT_COLORS: Record<string, string> = {
  'SUPERNOVA':  'from-violet-600 to-purple-800',
  'NOX':        'from-slate-600 to-slate-900',
  'NOX BLACK':  'from-zinc-700 to-zinc-950',
  'KOSMOS':     'from-blue-600 to-blue-900',
  'KOSMOS JR':  'from-sky-500 to-blue-700',
  'KOSMOS RED': 'from-rose-600 to-red-800',
  'ANTARA':     'from-pink-500 to-fuchsia-700',
  'SONIK':      'from-emerald-500 to-teal-700',
  'VESTA':      'from-amber-500 to-orange-700',
  'LOTUS':      'from-indigo-500 to-indigo-800',
}

function ProductPlaceholder({ name }: { name: string }) {
  const gradient = GRADIENT_COLORS[name] ?? 'from-slate-600 to-slate-800'
  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <span className="text-white text-3xl font-black opacity-80 select-none">
        {name.slice(0, 2)}
      </span>
    </div>
  )
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'EFECTIVO',      label: 'Efectivo',      icon: <Banknote className="h-4 w-4" /> },
  { value: 'QR',            label: 'QR',            icon: <QrCode className="h-4 w-4" /> },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: <Building2 className="h-4 w-4" /> },
]

// ─── VentasClient ─────────────────────────────────────────────────────────────

export function VentasClient({
  products, customers, initialSales,
}: {
  products: Product[]
  customers: Customer[]
  initialSales: Sale[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Catálogo
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Carrito
  const [cart, setCart] = useState<CartItem[]>([])

  // Pago
  const [isCredit, setIsCredit] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [customerId, setCustomerId] = useState('')

  // Historial
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Dialog variant picker
  const [qtyInput, setQtyInput] = useState<Record<number, string>>({})
  const [priceInput, setPriceInput] = useState<Record<number, string>>({})

  // ── Catálogo filtrado ──
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Abrir selector de variantes ──
  const openProduct = (product: Product) => {
    setSelectedProduct(product)
    const newQty: Record<number, string> = {}
    const newPrice: Record<number, string> = {}
    product.variants.forEach((v) => {
      newQty[v.id] = '1'
      newPrice[v.id] = String(v.defaultPrice)
    })
    setQtyInput(newQty)
    setPriceInput(newPrice)
  }

  // ── Añadir al carrito ──
  const addToCart = (product: Product, variant: Variant) => {
    const qty = parseInt(qtyInput[variant.id] || '1')
    const price = parseFloat(priceInput[variant.id] || String(variant.defaultPrice))
    if (qty < 1 || isNaN(qty)) return toast.error('Cantidad inválida')
    if (price <= 0 || isNaN(price)) return toast.error('Precio inválido')

    const baseUnitsNeeded = qty * variant.baseContentQty
    if (baseUnitsNeeded > product.stockInBaseUnits) {
      const avail = Math.floor(product.stockInBaseUnits / variant.baseContentQty)
      return toast.error(`Stock insuficiente. Disponible: ${avail} ${variant.presentation}`)
    }

    const cartKey = `${variant.id}`
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey)
      if (existing) {
        return prev.map((i) =>
          i.cartKey === cartKey ? { ...i, quantity: i.quantity + qty } : i
        )
      }
      return [...prev, {
        cartKey,
        variantId: variant.id,
        productName: product.name,
        productImage: product.imageUrl,
        presentation: variant.presentation,
        baseContentQty: variant.baseContentQty,
        baseUnitName: variant.baseUnitName,
        quantity: qty,
        unitPrice: price,
        stockInBaseUnits: product.stockInBaseUnits,
      }]
    })
    toast.success(`${product.name} — ${variant.presentation} añadido`)
    setSelectedProduct(null)
  }

  // ── Actualizar cantidad en carrito ──
  const updateCartQty = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartKey !== cartKey) return item
        const newQty = Math.max(1, item.quantity + delta)
        const maxQty = Math.floor(item.stockInBaseUnits / item.baseContentQty)
        return { ...item, quantity: Math.min(newQty, maxQty) }
      })
    )
  }

  const removeFromCart = (cartKey: string) =>
    setCart((prev) => prev.filter((i) => i.cartKey !== cartKey))

  const total = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  // ── Registrar venta ──
  const handleCheckout = () => {
    if (cart.length === 0) return toast.error('El carrito está vacío')
    if (isCredit && !customerId) return toast.error('Selecciona un cliente para venta a crédito')

    startTransition(async () => {
      const result = await registerSale({
        customerId: customerId ? +customerId : null,
        isCredit,
        paymentMethod,
        details: cart.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      })
      if (result.success) {
        toast.success(`✅ Venta #${result.data?.saleId} registrada · ${formatCurrency(total)}`)
        setCart([])
        setCustomerId('')
        setIsCredit(false)
        setPaymentMethod('EFECTIVO')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Ventas</h1>
        <p className="text-slate-400 mt-1">Selecciona productos del catálogo y registra la venta</p>
      </div>

      {/* ── Main layout: Catálogo + Carrito ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

        {/* ── CATÁLOGO (izquierda) ── */}
        <div className="xl:col-span-3 space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="product-search"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white pl-10 placeholder:text-slate-500"
            />
          </div>

          {/* Grid de productos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((product) => {
              const outOfStock = product.stockInBaseUnits === 0
              return (
                <button
                  key={product.id}
                  id={`product-card-${product.id}`}
                  onClick={() => !outOfStock && openProduct(product)}
                  disabled={outOfStock}
                  className={`group relative rounded-xl overflow-hidden border transition-all duration-200 text-left ${
                    outOfStock
                      ? 'border-slate-800 opacity-50 cursor-not-allowed'
                      : 'border-slate-700 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 hover:scale-[1.02] cursor-pointer'
                  }`}
                >
                  {/* Imagen / Placeholder */}
                  <div className="relative w-full aspect-square bg-slate-800">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="200px"
                        unoptimized
                      />
                    ) : (
                      <ProductPlaceholder name={product.name} />
                    )}

                    {/* Badge de stock */}
                    <div className="absolute top-2 right-2">
                      {outOfStock ? (
                        <Badge className="bg-rose-500/80 text-white text-xs px-1.5 py-0.5 backdrop-blur-sm">
                          Sin stock
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/80 text-white text-xs px-1.5 py-0.5 backdrop-blur-sm">
                          {product.stockInBaseUnits} {product.variants[0]?.baseUnitName ?? 'u'}
                        </Badge>
                      )}
                    </div>

                    {/* Overlay en hover */}
                    {!outOfStock && (
                      <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-emerald-500 rounded-full p-2 shadow-lg">
                          <Plus className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info del producto */}
                  <div className="p-2.5 bg-slate-900">
                    <p className="text-white font-semibold text-sm leading-tight">{product.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {product.variants.length} presentación{product.variants.length !== 1 ? 'es' : ''}
                    </p>
                  </div>
                </button>
              )
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-3 text-center py-12 text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>
        </div>

        {/* ── CARRITO (derecha) ── */}
        <div className="xl:col-span-2 sticky top-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-emerald-400" />
                  Carrito
                </div>
                {cart.length > 0 && (
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                    {cart.reduce((s, i) => s + i.quantity, 0)} items
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Items del carrito */}
              {cart.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">El carrito está vacío</p>
                  <p className="text-xs mt-1">Haz clic en un producto para agregarlo</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.cartKey} className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50">
                      {/* Imagen miniatura */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-700">
                        {item.productImage ? (
                          <Image src={item.productImage} alt={item.productName} width={40} height={40} className="object-cover w-full h-full" unoptimized />
                        ) : (
                          <ProductPlaceholder name={item.productName} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{item.productName}</p>
                        <p className="text-slate-400 text-xs">{item.presentation} · {formatCurrency(item.unitPrice)}</p>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartQty(item.cartKey, -1)}
                          className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-white text-sm w-5 text-center font-mono">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQty(item.cartKey, +1)}
                          className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Subtotal */}
                      <span className="text-emerald-400 text-xs font-semibold w-16 text-right shrink-0">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>

                      {/* Eliminar */}
                      <button
                        onClick={() => removeFromCart(item.cartKey)}
                        className="text-slate-500 hover:text-rose-400 transition-colors ml-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-slate-800" />

              {/* Tipo de pago: Contado / Crédito */}
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase tracking-wider">Tipo de venta</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: 'Contado', val: false }, { label: 'Crédito', val: true }].map(({ label, val }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setIsCredit(val)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-2 ${
                        isCredit === val
                          ? val
                            ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                            : 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Método de pago: Efectivo / QR / Transferencia */}
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase tracking-wider">Método de pago</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all border flex flex-col items-center gap-1 ${
                        paymentMethod === opt.value
                          ? 'bg-blue-500/15 border-blue-500 text-blue-400'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cliente (si es crédito) */}
              {isCredit && (
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs uppercase tracking-wider flex items-center gap-1">
                    <User className="h-3 w-3" /> Cliente *
                  </Label>
                  <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? '')}>
                    <SelectTrigger id="sale-customer" className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Seleccionar cliente..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)} className="text-white focus:bg-slate-700">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Total y botón */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Total a cobrar</span>
                  <span className="text-2xl font-bold text-emerald-400">{formatCurrency(total)}</span>
                </div>
                <Button
                  id="submit-sale"
                  onClick={handleCheckout}
                  disabled={isPending || cart.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-11"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Procesando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Registrar Venta
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── DIALOG: Selector de variantes ── */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          {selectedProduct && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-slate-800">
                    {selectedProduct.imageUrl ? (
                      <Image
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        width={56}
                        height={56}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <ProductPlaceholder name={selectedProduct.name} />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-white text-lg">{selectedProduct.name}</DialogTitle>
                    <p className="text-slate-400 text-sm">
                      Stock: {selectedProduct.stockInBaseUnits} {selectedProduct.variants[0]?.baseUnitName ?? 'u'}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <p className="text-slate-400 text-xs uppercase tracking-wider">Selecciona presentación y cantidad</p>
                {selectedProduct.variants.map((v) => {
                  const maxQty = Math.floor(selectedProduct.stockInBaseUnits / v.baseContentQty)
                  const qty = parseInt(qtyInput[v.id] || '1')
                  return (
                    <div key={v.id} className="bg-slate-800 rounded-xl p-3 space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-semibold">{v.presentation}</p>
                          <p className="text-slate-400 text-xs">
                            {v.baseContentQty > 1 ? `${v.baseContentQty} ${v.baseUnitName} por unidad · ` : ''}
                            Disponible: {maxQty} {v.presentation}{maxQty !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-emerald-600 text-emerald-400">
                          {formatCurrency(v.defaultPrice)}
                        </Badge>
                      </div>

                      {/* Controls */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Cantidad */}
                        <div>
                          <Label className="text-slate-400 text-xs mb-1 block">Cantidad</Label>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setQtyInput((p) => ({ ...p, [v.id]: String(Math.max(1, parseInt(p[v.id] || '1') - 1)) }))}
                              className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <Input
                              type="number"
                              min="1"
                              max={maxQty}
                              value={qtyInput[v.id] ?? '1'}
                              onChange={(e) => setQtyInput((p) => ({ ...p, [v.id]: e.target.value }))}
                              className="bg-slate-700 border-slate-600 text-white text-center h-8 w-12 p-0"
                            />
                            <button
                              onClick={() => setQtyInput((p) => ({ ...p, [v.id]: String(Math.min(maxQty, parseInt(p[v.id] || '1') + 1)) }))}
                              className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Precio */}
                        <div>
                          <Label className="text-slate-400 text-xs mb-1 block">Precio (Bs.)</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={priceInput[v.id] ?? String(v.defaultPrice)}
                            onChange={(e) => setPriceInput((p) => ({ ...p, [v.id]: e.target.value }))}
                            className="bg-slate-700 border-slate-600 text-white h-8"
                          />
                        </div>
                      </div>

                      {/* Subtotal + Agregar */}
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-400 text-sm">
                          Subtotal:{' '}
                          <span className="text-emerald-400 font-semibold">
                            {formatCurrency(qty * (parseFloat(priceInput[v.id] || String(v.defaultPrice)) || 0))}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          onClick={() => addToCart(selectedProduct, v)}
                          disabled={maxQty === 0}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Agregar
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── HISTORIAL ── */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <History className="h-4 w-4 text-blue-400" />
            Historial de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initialSales.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-10">No hay ventas registradas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">#</TableHead>
                  <TableHead className="text-slate-400">Fecha</TableHead>
                  <TableHead className="text-slate-400">Cliente</TableHead>
                  <TableHead className="text-slate-400">Método</TableHead>
                  <TableHead className="text-slate-400">Tipo</TableHead>
                  <TableHead className="text-slate-400 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialSales.map((s) => (
                  <React.Fragment key={s.id}>
                    <TableRow
                      className="border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    >
                      <TableCell className="text-slate-300 font-mono text-xs">#{s.id}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{formatDate(s.date)}</TableCell>
                      <TableCell className="text-white text-sm">
                        {s.customer?.name ?? <span className="text-slate-500">Anónimo</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-blue-700 text-blue-300 text-xs">
                          {s.paymentMethod === 'EFECTIVO' ? '💵 Efectivo' : s.paymentMethod === 'QR' ? '📱 QR' : '🏦 Trans.'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={s.isCredit ? 'border-amber-500 text-amber-400' : 'border-emerald-600 text-emerald-400'}
                        >
                          {s.isCredit ? 'Crédito' : 'Contado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-400">
                        {formatCurrency(s.totalAmount)}
                      </TableCell>
                    </TableRow>
                    {expandedId === s.id && (
                      <TableRow className="border-slate-800 bg-slate-800/30">
                        <TableCell colSpan={6} className="py-3 px-6">
                          <div className="space-y-1.5">
                            {s.details.map((d) => {
                              const baseUnits = d.quantity * d.variant.baseContentQty
                              return (
                                <div key={d.id} className="flex justify-between text-sm">
                                  <span className="text-slate-300">
                                    {d.variant.product.name} — {d.variant.presentation}
                                    {d.variant.baseContentQty > 1 && (
                                      <span className="text-slate-500 text-xs ml-2">
                                        ({d.quantity} × {d.variant.baseContentQty} = {baseUnits} {d.variant.baseUnitName})
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-slate-400">
                                    {d.quantity} × {formatCurrency(d.unitPrice)} ={' '}
                                    <span className="text-emerald-400 font-medium">
                                      {formatCurrency(d.quantity * d.unitPrice)}
                                    </span>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
