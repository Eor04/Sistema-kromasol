'use client'

import React, { useState, useTransition } from 'react'
import {
  BookOpen, ArrowDownCircle, ArrowUpCircle, RefreshCw,
  ChevronDown, ChevronRight, Search, Package, Users,
  ShoppingCart, Calendar, Hash, Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getMovementDetail } from '@/actions/kardex.actions'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Movement = {
  id: number
  date: Date
  type: 'IN' | 'OUT' | 'ADJUST'
  quantity: number
  balance: number
  description: string
  referenceId: number | null
  variant: {
    presentation: string
    baseUnitName: string
    product: { name: string }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MovementDetail = { type: 'SALE' | 'PURCHASE'; data: any } | null

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  IN: { label: 'Entrada', icon: ArrowDownCircle, color: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' },
  OUT: { label: 'Salida', icon: ArrowUpCircle, color: 'text-rose-400', badge: 'bg-rose-500/10 border-rose-500/50 text-rose-400' },
  ADJUST: { label: 'Ajuste', icon: RefreshCw, color: 'text-blue-400', badge: 'bg-blue-500/10 border-blue-500/50 text-blue-400' },
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function SaleDetailPanel({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {/* Header info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-700/40 rounded-lg p-2.5">
          <p className="text-slate-400 text-xs">Venta #</p>
          <p className="text-white font-bold">{data.id}</p>
        </div>
        <div className="bg-slate-700/40 rounded-lg p-2.5">
          <p className="text-slate-400 text-xs">Fecha</p>
          <p className="text-white text-sm">{formatDate(data.date)}</p>
        </div>
        <div className="bg-slate-700/40 rounded-lg p-2.5">
          <p className="text-slate-400 text-xs">Cliente</p>
          <p className="text-white text-sm">{data.customer?.name ?? 'Venta directa'}</p>
        </div>
        <div className="bg-slate-700/40 rounded-lg p-2.5">
          <p className="text-slate-400 text-xs">Total</p>
          <p className="text-emerald-400 font-bold">{formatCurrency(data.totalAmount)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Badge variant="outline" className={data.isCredit ? 'border-amber-500 text-amber-400' : 'border-emerald-600 text-emerald-400'}>
          {data.isCredit ? '⏳ Crédito' : '✅ Contado'}
        </Badge>
        <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
          💳 {data.paymentMethod}
        </Badge>
      </div>

      {/* Items */}
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Productos vendidos</p>
        <div className="space-y-1.5">
          {data.details?.map((d: any) => (
            <div key={d.id} className="flex justify-between items-center bg-slate-700/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                {d.variant?.product?.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.variant.product.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover" />
                )}
                <div>
                  <p className="text-white text-sm font-medium">{d.variant?.product?.name}</p>
                  <p className="text-slate-400 text-xs">{d.variant?.presentation} × {d.quantity}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-sm">{formatCurrency(d.unitPrice)}/u</p>
                <p className="text-emerald-400 text-xs font-semibold">{formatCurrency(d.quantity * d.unitPrice)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PurchaseDetailPanel({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-700/40 rounded-lg p-2.5">
          <p className="text-slate-400 text-xs">Compra #</p>
          <p className="text-white font-bold">{data.id}</p>
        </div>
        <div className="bg-slate-700/40 rounded-lg p-2.5">
          <p className="text-slate-400 text-xs">Período</p>
          <p className="text-white text-sm">{data.period}</p>
        </div>
        <div className="bg-slate-700/40 rounded-lg p-2.5">
          <p className="text-slate-400 text-xs">Total invertido</p>
          <p className="text-blue-400 font-bold">{formatCurrency(data.totalCost)}</p>
        </div>
      </div>

      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Productos comprados</p>
        <div className="space-y-1.5">
          {data.details?.map((d: any) => (
            <div key={d.id} className="flex justify-between items-center bg-slate-700/30 rounded-lg px-3 py-2">
              <div>
                <p className="text-white text-sm font-medium">{d.variant?.product?.name}</p>
                <p className="text-slate-400 text-xs">{d.variant?.presentation} × {d.quantity}</p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm">{formatCurrency(d.unitCost)}/u</p>
                <p className="text-blue-400 text-xs font-semibold">{formatCurrency(d.quantity * d.unitCost)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── KardexClient ─────────────────────────────────────────────────────────────

export function KardexClient({ initialMovements }: { initialMovements: Movement[] }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT' | 'ADJUST'>('ALL')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailCache, setDetailCache] = useState<Record<number, MovementDetail>>({})
  const [isPending, startTransition] = useTransition()

  const filtered = initialMovements.filter((m) => {
    const matchesType = filterType === 'ALL' || m.type === filterType
    const term = search.toLowerCase()
    const matchesSearch =
      m.variant.product.name.toLowerCase().includes(term) ||
      m.variant.presentation.toLowerCase().includes(term) ||
      m.description.toLowerCase().includes(term)
    return matchesType && matchesSearch
  })

  const totals = {
    IN: initialMovements.filter((m) => m.type === 'IN').reduce((s, m) => s + m.quantity, 0),
    OUT: initialMovements.filter((m) => m.type === 'OUT').reduce((s, m) => s + m.quantity, 0),
    ADJUST: initialMovements.filter((m) => m.type === 'ADJUST').length,
  }

  // ── Expandir fila ──
  const toggleRow = (m: Movement) => {
    if (expandedId === m.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(m.id)

    // Solo carga detalle si tiene referenceId y no está en caché
    if (m.referenceId && !detailCache[m.id] && m.type !== 'ADJUST') {
      startTransition(async () => {
        const result = await getMovementDetail(m.type, m.referenceId!)
        if (result.success) {
          setDetailCache((prev) => ({
            ...prev,
            [m.id]: { type: result.type!, data: result.data },
          }))
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Kardex</h1>
        <p className="text-slate-400 mt-1 text-sm">Registro detallado de movimientos de inventario · Clic en una fila para ver el detalle</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {(['IN', 'OUT', 'ADJUST'] as const).map((type) => {
          const cfg = TYPE_CONFIG[type]
          const Icon = cfg.icon
          return (
            <Card key={type}
              className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-slate-600 ${filterType === type ? 'ring-1 ring-slate-500' : ''}`}
              onClick={() => setFilterType(filterType === type ? 'ALL' : type)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs text-slate-400">{cfg.label}s</CardTitle>
                <div className={`p-1.5 rounded-lg ${cfg.badge}`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${cfg.color}`}>{totals[type]}</p>
                <p className="text-slate-600 text-xs mt-1">
                  {type === 'IN' ? 'unidades ingresadas' : type === 'OUT' ? 'unidades salidas' : 'movimientos'}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="kardex-search"
                placeholder="Buscar producto, variante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(['ALL', 'IN', 'OUT', 'ADJUST'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    filterType === type
                      ? type === 'ALL'
                        ? 'bg-slate-700 border-slate-500 text-white'
                        : `border-current ${TYPE_CONFIG[type].color} bg-current/5`
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {type === 'ALL' ? 'Todos' : TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>
            <span className="text-slate-500 text-xs ml-auto">{filtered.length} movimientos</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-6" />
                <TableHead className="text-slate-400">Fecha</TableHead>
                <TableHead className="text-slate-400">Producto</TableHead>
                <TableHead className="text-slate-400">Variante</TableHead>
                <TableHead className="text-slate-400 text-center">Tipo</TableHead>
                <TableHead className="text-slate-400 text-right">Cantidad</TableHead>
                <TableHead className="text-slate-400 text-right">Balance</TableHead>
                <TableHead className="text-slate-400">Descripción</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-500 py-12">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No hay movimientos</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const cfg = TYPE_CONFIG[m.type]
                  const Icon = cfg.icon
                  const isExpanded = expandedId === m.id
                  const detail = detailCache[m.id]
                  const canExpand = !!m.referenceId && m.type !== 'ADJUST'

                  return (
                    <React.Fragment key={m.id}>
                      <TableRow
                        className={`border-slate-800 transition-colors ${canExpand ? 'cursor-pointer hover:bg-slate-800/70' : 'hover:bg-slate-800/30'} ${isExpanded ? 'bg-slate-800/50 border-l-2 border-l-slate-500' : ''}`}
                        onClick={() => canExpand && toggleRow(m)}
                      >
                        {/* Expand toggle */}
                        <TableCell className="pr-0 pl-3">
                          {canExpand && (
                            <div className="text-slate-500">
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4" />
                                : <ChevronRight className="h-4 w-4" />}
                            </div>
                          )}
                        </TableCell>

                        {/* Fecha */}
                        <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 opacity-50" />
                            {formatDate(m.date)}
                          </div>
                        </TableCell>

                        {/* Producto */}
                        <TableCell className="font-semibold text-white">{m.variant.product.name}</TableCell>

                        {/* Variante */}
                        <TableCell className="text-slate-400 text-sm">{m.variant.presentation}</TableCell>

                        {/* Tipo */}
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${cfg.badge} text-xs border`}>
                            <Icon className="h-3 w-3 mr-1 inline" />
                            {cfg.label}
                          </Badge>
                        </TableCell>

                        {/* Cantidad */}
                        <TableCell className={`text-right font-mono font-bold ${cfg.color}`}>
                          {m.type === 'OUT' ? '−' : '+'}{m.quantity}
                        </TableCell>

                        {/* Balance */}
                        <TableCell className="text-right font-mono text-slate-300 font-semibold">
                          {m.balance}
                        </TableCell>

                        {/* Descripción */}
                        <TableCell className="text-slate-400 text-xs max-w-[220px]">
                          <p className="truncate" title={m.description}>{m.description}</p>
                          {m.referenceId && m.type !== 'ADJUST' && (
                            <span className="flex items-center gap-1 text-slate-600 mt-0.5">
                              <Hash className="h-2.5 w-2.5" />
                              Ref. #{m.referenceId}
                            </span>
                          )}
                        </TableCell>

                        {/* Ver detalle */}
                        <TableCell>
                          {canExpand && (
                            <Eye className={`h-3.5 w-3.5 transition-colors ${isExpanded ? 'text-slate-300' : 'text-slate-600'}`} />
                          )}
                        </TableCell>
                      </TableRow>

                      {/* ── Fila expandida con detalle ── */}
                      {isExpanded && (
                        <TableRow className="border-slate-800 bg-slate-800/20">
                          <TableCell colSpan={9} className="py-4 px-6">
                            {isPending && !detail ? (
                              <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <span className="h-4 w-4 rounded-full border-2 border-slate-400/30 border-t-slate-400 animate-spin" />
                                Cargando detalle...
                              </div>
                            ) : !detail ? (
                              <p className="text-slate-500 text-sm">No se pudo cargar el detalle de esta transacción.</p>
                            ) : detail.type === 'SALE' ? (
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-3">
                                  <Users className="h-3 w-3" /> Detalle de venta
                                </p>
                                <SaleDetailPanel data={detail.data} />
                              </div>
                            ) : detail.type === 'PURCHASE' ? (
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-3">
                                  <ShoppingCart className="h-3 w-3" /> Detalle de compra
                                </p>
                                <PurchaseDetailPanel data={detail.data} />
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
