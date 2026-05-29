'use client'

import React, { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ShoppingCart, Trash2, Plus, Minus, History, Search,
  Package, X, Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { registerPurchase } from '@/actions/purchase.actions'
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

type PurchaseDetail = {
  id: number
  quantity: number
  unitCost: number
  variant: {
    presentation: string
    baseContentQty: number
    baseUnitName: string
    product: { name: string }
  }
}

type Purchase = {
  id: number
  period: string
  date: Date
  totalCost: number
  promoType: string | null
  details: PurchaseDetail[]
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
  unitCost: number
}

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

// ─── PurchasesClient ──────────────────────────────────────────────────────────

export function PurchasesClient({
  products,
  initialPurchases,
}: {
  products: Product[]
  initialPurchases: Purchase[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Catálogo
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Carrito de compra
  const [cart, setCart] = useState<CartItem[]>([])

  // Encabezado de compra
  const [period, setPeriod] = useState('')
  const [promoType, setPromoType] = useState('')

  // Historial
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Dialog variant picker
  const [qtyInput, setQtyInput] = useState<Record<number, string>>({})
  const [costInput, setCostInput] = useState<Record<number, string>>({})

  // ── Catálogo filtrado ──
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Abrir selector de variantes ──
  const openProduct = (product: Product) => {
    setSelectedProduct(product)
    const newQty: Record<number, string> = {}
    const newCost: Record<number, string> = {}
    product.variants.forEach((v) => {
      newQty[v.id] = '1'
      newCost[v.id] = ''   // Costo en blanco — el usuario ingresa el precio de compra
    })
    setQtyInput(newQty)
    setCostInput(newCost)
  }

  // ── Añadir al carrito ──
  const addToCart = (product: Product, variant: Variant) => {
    const qty = parseInt(qtyInput[variant.id] || '1')
    const cost = parseFloat(costInput[variant.id] || '')
    if (qty < 1 || isNaN(qty)) return toast.error('Cantidad inválida')
    if (!costInput[variant.id] || cost <= 0 || isNaN(cost))
      return toast.error('Ingresa el costo de compra')

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
        unitCost: cost,
      }]
    })
    toast.success(`${product.name} — ${variant.presentation} agregado`)
    setSelectedProduct(null)
  }

  // ── Actualizar cantidad en carrito ──
  const updateCartQty = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.cartKey === cartKey
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    )
  }

  const removeFromCart = (cartKey: string) =>
    setCart((prev) => prev.filter((i) => i.cartKey !== cartKey))

  const total = cart.reduce((s, i) => s + i.quantity * i.unitCost, 0)

  // ── Registrar compra ──
  const handleCheckout = () => {
    if (!period.trim()) return toast.error('Ingresa el período de compra (ej. Mayo-2026)')
    if (cart.length === 0) return toast.error('El carrito está vacío')

    startTransition(async () => {
      const result = await registerPurchase({
        period: period.trim(),
        promoType: promoType.trim() || undefined,
        details: cart.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      })
      if (result.success) {
        toast.success(`✅ Compra #${result.data.purchaseId} registrada · ${formatCurrency(total)}`)
        setCart([])
        setPeriod('')
        setPromoType('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const [mobileTab, setMobileTab] = useState<'catalogo' | 'carrito'>('catalogo')
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Compras</h1>
        <p className="text-slate-400 mt-1 text-sm">Selecciona productos del catálogo · El precio de compra lo ingresas tú</p>
      </div>

      {/* ── Tabs mobile ── */}
      <div className="flex xl:hidden gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setMobileTab('catalogo')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            mobileTab === 'catalogo' ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
        >
          <Package className="h-4 w-4" /> Catálogo
        </button>
        <button
          onClick={() => setMobileTab('carrito')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 relative ${
            mobileTab === 'carrito' ? 'bg-blue-600 text-white' : 'text-slate-400'
          }`}
        >
          <ShoppingCart className="h-4 w-4" /> Orden
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Main layout: Catálogo + Carrito ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6 items-start">

        {/* ── CATÁLOGO (izquierda) ── */}
        <div className={`xl:col-span-3 space-y-4 ${mobileTab === 'carrito' ? 'hidden xl:block' : ''}`}>
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="purchase-product-search"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white pl-10 placeholder:text-slate-500"
            />
          </div>

          {/* Grid de productos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                id={`purchase-card-${product.id}`}
                onClick={() => openProduct(product)}
                className="group relative rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 hover:scale-[1.02] transition-all duration-200 text-left cursor-pointer"
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

                  {/* Badge de stock actual */}
                  <div className="absolute top-2 right-2">
                    <Badge className={`text-white text-xs px-1.5 py-0.5 backdrop-blur-sm ${
                      product.stockInBaseUnits === 0
                        ? 'bg-rose-500/80'
                        : product.stockInBaseUnits <= 20
                        ? 'bg-amber-500/80'
                        : 'bg-blue-500/80'
                    }`}>
                      {product.stockInBaseUnits === 0
                        ? 'Sin stock'
                        : `${product.stockInBaseUnits} ${product.variants[0]?.baseUnitName ?? 'u'}`}
                    </Badge>
                  </div>

                  {/* Overlay en hover */}
                  <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-blue-500 rounded-full p-2 shadow-lg">
                      <Plus className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Info del producto */}
                <div className="p-2.5 bg-slate-900">
                  <p className="text-white font-semibold text-sm leading-tight">{product.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {product.variants.length} presentación{product.variants.length !== 1 ? 'es' : ''}
                  </p>
                </div>
              </button>
            ))}

            {filteredProducts.length === 0 && (
              <div className="col-span-3 text-center py-12 text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>
        </div>

        {/* ── CARRITO DE COMPRA (derecha) ── */}
        <div className={`xl:col-span-2 xl:sticky xl:top-4 ${mobileTab === 'catalogo' ? 'hidden xl:block' : ''}`}>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-400" />
                  Orden de Compra
                </div>
                {cart.length > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                    {cart.reduce((s, i) => s + i.quantity, 0)} items
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Encabezado: Período + Promo */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs uppercase tracking-wider">Período *</Label>
                  <Input
                    id="purchase-period"
                    placeholder="ej. Mayo-2026"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs uppercase tracking-wider">Promoción</Label>
                  <Input
                    id="purchase-promo"
                    placeholder="Descuento, promo..."
                    value={promoType}
                    onChange={(e) => setPromoType(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800" />

              {/* Items del carrito */}
              {cart.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Carrito vacío</p>
                  <p className="text-xs mt-1">Haz clic en un producto para agregar</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {cart.map((item) => {
                    const baseTotal = item.quantity * item.baseContentQty
                    return (
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
                          <p className="text-slate-400 text-xs">{item.presentation} · {formatCurrency(item.unitCost)}</p>
                          {item.baseContentQty > 1 && (
                            <p className="text-blue-400 text-xs">+{baseTotal} {item.baseUnitName} al stock</p>
                          )}
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
                        <span className="text-blue-400 text-xs font-semibold w-16 text-right shrink-0">
                          {formatCurrency(item.quantity * item.unitCost)}
                        </span>

                        {/* Eliminar */}
                        <button
                          onClick={() => removeFromCart(item.cartKey)}
                          className="text-slate-500 hover:text-rose-400 transition-colors ml-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Total y botón */}
              {cart.length > 0 && (
                <>
                  <div className="border-t border-slate-800" />
                  <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Total de compra</span>
                      <span className="text-2xl font-bold text-blue-400">{formatCurrency(total)}</span>
                    </div>
                    <Button
                      id="submit-purchase"
                      onClick={handleCheckout}
                      disabled={isPending}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold h-11"
                    >
                      {isPending ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Registrando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Registrar Compra
                        </span>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── DIALOG: Selector de variantes para compra ── */}
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
                      Stock actual: <span className="text-blue-400 font-medium">{selectedProduct.stockInBaseUnits} {selectedProduct.variants[0]?.baseUnitName ?? 'u'}</span>
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <p className="text-slate-400 text-xs uppercase tracking-wider">Selecciona presentación e ingresa el costo</p>
                {selectedProduct.variants.map((v) => {
                  const qty = parseInt(qtyInput[v.id] || '1')
                  const cost = parseFloat(costInput[v.id] || '0')
                  return (
                    <div key={v.id} className="bg-slate-800 rounded-xl p-3 space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-blue-400" />
                          <div>
                            <p className="text-white font-semibold">{v.presentation}</p>
                            {v.baseContentQty > 1 && (
                              <p className="text-slate-400 text-xs">{v.baseContentQty} {v.baseUnitName} por unidad</p>
                            )}
                          </div>
                        </div>
                        {/* Stock actual en esta presentación */}
                        <Badge variant="outline" className="border-blue-700 text-blue-300 text-xs">
                          ≈{Math.floor(selectedProduct.stockInBaseUnits / v.baseContentQty)} en stock
                        </Badge>
                      </div>

                      {/* Controls */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Cantidad */}
                        <div>
                          <Label className="text-slate-400 text-xs mb-1 block">Cantidad a comprar</Label>
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
                              value={qtyInput[v.id] ?? '1'}
                              onChange={(e) => setQtyInput((p) => ({ ...p, [v.id]: e.target.value }))}
                              className="bg-slate-700 border-slate-600 text-white text-center h-8 w-12 p-0"
                            />
                            <button
                              onClick={() => setQtyInput((p) => ({ ...p, [v.id]: String(parseInt(p[v.id] || '1') + 1) }))}
                              className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Costo de compra (usuario lo ingresa) */}
                        <div>
                          <Label className="text-slate-400 text-xs mb-1 block">Costo unitario (Bs.)</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Precio de compra"
                            value={costInput[v.id] ?? ''}
                            onChange={(e) => setCostInput((p) => ({ ...p, [v.id]: e.target.value }))}
                            className="bg-slate-700 border-slate-600 text-white h-8 placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      {/* Info de stock que se agregará + subtotal + Agregar */}
                      <div className="flex justify-between items-center pt-1">
                        <div>
                          {v.baseContentQty > 1 && qty > 0 ? (
                            <span className="text-xs text-blue-400">
                              +{qty * v.baseContentQty} {v.baseUnitName} al inventario
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">{qty} {v.presentation}</span>
                          )}
                          {cost > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Subtotal: <span className="text-blue-400 font-semibold">{formatCurrency(qty * cost)}</span>
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(selectedProduct, v)}
                          className="bg-blue-600 hover:bg-blue-500 text-white"
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
            Historial de Compras
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initialPurchases.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-10">No hay compras registradas aún</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">#</TableHead>
                  <TableHead className="text-slate-400">Período</TableHead>
                  <TableHead className="text-slate-400">Fecha</TableHead>
                  <TableHead className="text-slate-400">Promoción</TableHead>
                  <TableHead className="text-slate-400 text-center">Ítems</TableHead>
                  <TableHead className="text-slate-400 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPurchases.map((p) => (
                  <React.Fragment key={p.id}>
                    <TableRow
                      className="border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    >
                      <TableCell className="text-slate-300 font-mono text-xs">#{p.id}</TableCell>
                      <TableCell className="text-white font-medium">{p.period}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{formatDate(p.date)}</TableCell>
                      <TableCell>
                        {p.promoType ? (
                          <Badge variant="outline" className="border-blue-500 text-blue-400 text-xs">
                            {p.promoType}
                          </Badge>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                          {p.details.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-400">
                        {formatCurrency(p.totalCost)}
                      </TableCell>
                    </TableRow>
                    {expandedId === p.id && (
                      <TableRow className="border-slate-800 bg-slate-800/30">
                        <TableCell colSpan={6} className="py-3 px-6">
                          <div className="space-y-1.5">
                            {p.details.map((d) => {
                              const baseUnits = d.quantity * d.variant.baseContentQty
                              return (
                                <div key={d.id} className="flex justify-between text-sm">
                                  <span className="text-slate-300">
                                    {d.variant.product.name} — {d.variant.presentation}
                                    {d.variant.baseContentQty > 1 && (
                                      <span className="text-blue-400 text-xs ml-2">
                                        (+{d.quantity} × {d.variant.baseContentQty} = {baseUnits} {d.variant.baseUnitName})
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-slate-400">
                                    {d.quantity} × {formatCurrency(d.unitCost)} ={' '}
                                    <span className="text-blue-400 font-medium">
                                      {formatCurrency(d.quantity * d.unitCost)}
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
