'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Wallet, TrendingUp, TrendingDown, ShoppingCart, Receipt,
  Plus, Trash2, Settings, ArrowUpCircle, ArrowDownCircle,
  Banknote, Tag, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { registerGasto, deleteGasto, updateCapitalInicial } from '@/actions/caja.actions'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type GastoCategory = 'TRANSPORTE' | 'SERVICIOS' | 'PERSONAL' | 'MARKETING' | 'ALQUILER' | 'OTROS'

type Gasto = {
  id: number
  date: Date
  description: string
  amount: number
  category: GastoCategory
  notes: string | null
}

type CuotaPagada = {
  id: number
  monto: number
  numeroCuota: number
  fechaPago: Date | null
  sale: { id: number; customer: { name: string } | null }
}

type ResumenData = {
  saldoActual: number
  capitalInicial: number
  totalVentasContado: number
  totalVentasCredito: number
  totalCuotasCobradas: number
  totalCompras: number
  totalGastos: number
  gastos: Gasto[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ventas: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compras: any[]
  cuotasPagadas: CuotaPagada[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<GastoCategory, string> = {
  TRANSPORTE: '🚗 Transporte',
  SERVICIOS:  '⚡ Servicios',
  PERSONAL:   '👤 Personal',
  MARKETING:  '📣 Marketing',
  ALQUILER:   '🏠 Alquiler',
  OTROS:      '📦 Otros',
}

const CATEGORY_COLORS: Record<GastoCategory, string> = {
  TRANSPORTE: 'border-sky-500 text-sky-400',
  SERVICIOS:  'border-yellow-500 text-yellow-400',
  PERSONAL:   'border-purple-500 text-purple-400',
  MARKETING:  'border-pink-500 text-pink-400',
  ALQUILER:   'border-orange-500 text-orange-400',
  OTROS:      'border-slate-500 text-slate-400',
}

type MovimientoTipo = 'VENTA' | 'COMPRA' | 'GASTO' | 'COBRO'

type Movimiento = {
  id: string
  date: Date
  tipo: MovimientoTipo
  descripcion: string
  monto: number
}

function buildTimeline(data: ResumenData): Movimiento[] {
  const movs: Movimiento[] = []

  data.ventas.filter((v: any) => !v.isCredit).forEach((v: any) => {
    movs.push({
      id: `v-${v.id ?? Math.random()}`,
      date: new Date(v.date),
      tipo: 'VENTA',
      descripcion: `Venta · ${v.paymentMethod ?? 'Contado'}${v.customer ? ` — ${v.customer.name}` : ''}`,
      monto: v.totalAmount,
    })
  })

  data.compras.forEach((c: any) => {
    movs.push({
      id: `c-${c.id ?? Math.random()}`,
      date: new Date(c.date),
      tipo: 'COMPRA',
      descripcion: `Compra · ${c.period ?? ''}`,
      monto: -c.totalCost,
    })
  })

  data.gastos.forEach((g: Gasto) => {
    movs.push({
      id: `g-${g.id}`,
      date: new Date(g.date),
      tipo: 'GASTO',
      descripcion: `${CATEGORY_LABELS[g.category]} · ${g.description}`,
      monto: -g.amount,
    })
  })

  // Cuotas cobradas = ingresos de crédito
  data.cuotasPagadas.forEach((q) => {
    movs.push({
      id: `q-${q.id}`,
      date: new Date(q.fechaPago ?? new Date()),
      tipo: 'COBRO',
      descripcion: `Cobro cuota #${q.numeroCuota}${q.sale.customer ? ` — ${q.sale.customer.name}` : ''} (Venta #${q.sale.id})`,
      monto: q.monto,
    })
  })

  return movs.sort((a, b) => b.date.getTime() - a.date.getTime())
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon, color, sub,
}: {
  title: string
  value: string
  icon: React.ReactNode
  color: string
  sub?: string
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl bg-slate-800 ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── CajaClient ───────────────────────────────────────────────────────────────

export function CajaClient({ data }: { data: ResumenData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Gasto form
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<GastoCategory>('OTROS')
  const [notes, setNotes] = useState('')
  const [gastoDate, setGastoDate] = useState('')

  // Capital inicial
  const [showCapital, setShowCapital] = useState(false)
  const [capitalInput, setCapitalInput] = useState(String(data.capitalInicial))

  // Timeline expand
  const [showAllMovs, setShowAllMovs] = useState(false)
  const [activeTab, setActiveTab] = useState<'gastos' | 'movimientos'>('movimientos')

  const timeline = buildTimeline(data)
  const displayedMovs = showAllMovs ? timeline : timeline.slice(0, 20)

  // ── Registrar gasto ──
  const handleGasto = () => {
    if (!desc.trim()) return toast.error('Ingresa una descripción')
    if (!amount || parseFloat(amount) <= 0) return toast.error('Ingresa un monto válido')

    startTransition(async () => {
      const result = await registerGasto({
        description: desc.trim(),
        amount: parseFloat(amount),
        category,
        notes: notes.trim() || undefined,
        date: gastoDate ? new Date(gastoDate) : undefined,
      })
      if (result.success) {
        toast.success('✅ Gasto registrado')
        setDesc(''); setAmount(''); setNotes(''); setGastoDate('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  // ── Eliminar gasto ──
  const handleDeleteGasto = (id: number) => {
    startTransition(async () => {
      const result = await deleteGasto(id)
      if (result.success) { toast.success('Gasto eliminado'); router.refresh() }
      else toast.error(result.error)
    })
  }

  // ── Actualizar capital ──
  const handleCapital = () => {
    const val = parseFloat(capitalInput)
    if (isNaN(val) || val < 0) return toast.error('Monto inválido')
    startTransition(async () => {
      const result = await updateCapitalInicial(val)
      if (result.success) { toast.success('Capital actualizado'); setShowCapital(false); router.refresh() }
      else toast.error(result.error)
    })
  }

  const saldoColor = data.saldoActual >= 0 ? 'text-emerald-400' : 'text-rose-400'

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Caja</h1>
          <p className="text-slate-400 mt-1">Control financiero de tu negocio</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCapital(!showCapital)}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <Settings className="h-4 w-4 mr-2" />
          Capital inicial
        </Button>
      </div>

      {/* ── Panel capital inicial ── */}
      {showCapital && (
        <Card className="bg-slate-900 border-amber-700/50">
          <CardContent className="p-4">
            <p className="text-amber-400 text-sm font-medium mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Define el capital inicial de tu negocio (dinero con el que empezaste)
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-slate-400 text-xs">Capital inicial (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={capitalInput}
                  onChange={(e) => setCapitalInput(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="0.00"
                />
              </div>
              <Button onClick={handleCapital} disabled={isPending} className="bg-amber-600 hover:bg-amber-500 text-white">
                Guardar
              </Button>
              <Button variant="ghost" onClick={() => setShowCapital(false)} className="text-slate-400">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Cards ── */}
      {/* Saldo actual (grande) */}
      <Card className={`border-2 ${data.saldoActual >= 0 ? 'border-emerald-600/40 bg-emerald-950/20' : 'border-rose-600/40 bg-rose-950/20'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">💰 Saldo Actual</p>
              <p className={`text-5xl font-black ${saldoColor}`}>{formatCurrency(data.saldoActual)}</p>
              <p className="text-slate-500 text-xs mt-2">
                Capital {formatCurrency(data.capitalInicial)}
                {' '}+ Ventas contado {formatCurrency(data.totalVentasContado)}
                {(data.totalCuotasCobradas ?? 0) > 0 && <> + Cuotas cobradas {formatCurrency(data.totalCuotasCobradas)}</>}
                {' '}− Compras {formatCurrency(data.totalCompras)}
                {' '}− Gastos {formatCurrency(data.totalGastos)}
              </p>
            </div>
            <div className={`p-5 rounded-2xl ${data.saldoActual >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
              <Wallet className={`h-12 w-12 ${saldoColor}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard
          title="Ventas (contado)"
          value={formatCurrency(data.totalVentasContado)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="text-emerald-400"
          sub={`${data.ventas.filter((v: any) => !v.isCredit).length} ventas`}
        />
        <KpiCard
          title="Cuotas cobradas"
          value={formatCurrency(data.totalCuotasCobradas ?? 0)}
          icon={<Banknote className="h-5 w-5" />}
          color="text-teal-400"
          sub="Créditos cobrados"
        />
        <KpiCard
          title="Crédito pendiente"
          value={formatCurrency(data.totalVentasCredito - (data.totalCuotasCobradas ?? 0))}
          icon={<Receipt className="h-5 w-5" />}
          color="text-amber-400"
          sub="Por cobrar"
        />
        <KpiCard
          title="Compras"
          value={formatCurrency(data.totalCompras)}
          icon={<ShoppingCart className="h-5 w-5" />}
          color="text-blue-400"
          sub={`${data.compras.length} órdenes`}
        />
        <KpiCard
          title="Gastos"
          value={formatCurrency(data.totalGastos)}
          icon={<TrendingDown className="h-5 w-5" />}
          color="text-rose-400"
          sub={`${data.gastos.length} gastos`}
        />
      </div>

      {/* ── Layout: Formulario + Tabla ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 items-start">

        {/* ── Registrar Gasto ── */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-rose-400" />
              Registrar Gasto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Descripción *</Label>
              <Input
                id="gasto-desc"
                placeholder="ej. Gasolina del camión"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Monto (Bs.) *</Label>
                <Input
                  id="gasto-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Fecha</Label>
                <Input
                  id="gasto-date"
                  type="date"
                  value={gastoDate}
                  onChange={(e) => setGastoDate(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Categoría</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as GastoCategory)}>
                <SelectTrigger id="gasto-category" className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(Object.keys(CATEGORY_LABELS) as GastoCategory[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-white focus:bg-slate-700">
                      {CATEGORY_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Notas (opcional)</Label>
              <Input
                id="gasto-notes"
                placeholder="Detalle adicional..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <Button
              id="submit-gasto"
              onClick={handleGasto}
              disabled={isPending}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white h-10"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Guardando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar Gasto
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── Tabla derecha: Movimientos / Gastos ── */}
        <div className="xl:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {([
              { key: 'movimientos', label: 'Timeline de movimientos' },
              { key: 'gastos', label: `Gastos (${data.gastos.length})` },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  activeTab === key
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Timeline de movimientos ── */}
          {activeTab === 'movimientos' && (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-0">
                {timeline.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-10">No hay movimientos registrados</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-transparent">
                          <TableHead className="text-slate-400">Fecha</TableHead>
                          <TableHead className="text-slate-400">Tipo</TableHead>
                          <TableHead className="text-slate-400">Descripción</TableHead>
                          <TableHead className="text-slate-400 text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedMovs.map((mov) => (
                          <TableRow key={mov.id} className="border-slate-800 hover:bg-slate-800/50">
                            <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                              {formatDate(mov.date)}
                            </TableCell>
                            <TableCell>
                              {mov.tipo === 'VENTA' ? (
                                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-600/30 border text-xs gap-1">
                                  <ArrowUpCircle className="h-3 w-3" /> Venta
                                </Badge>
                              ) : mov.tipo === 'COBRO' ? (
                                <Badge className="bg-teal-500/15 text-teal-400 border-teal-600/30 border text-xs gap-1">
                                  <ArrowUpCircle className="h-3 w-3" /> Cobro
                                </Badge>
                              ) : mov.tipo === 'COMPRA' ? (
                                <Badge className="bg-blue-500/15 text-blue-400 border-blue-600/30 border text-xs gap-1">
                                  <ArrowDownCircle className="h-3 w-3" /> Compra
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-500/15 text-rose-400 border-rose-600/30 border text-xs gap-1">
                                  <ArrowDownCircle className="h-3 w-3" /> Gasto
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm">{mov.descripcion}</TableCell>
                            <TableCell className={`text-right font-semibold text-sm ${mov.monto >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {mov.monto >= 0 ? '+' : ''}{formatCurrency(Math.abs(mov.monto))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {timeline.length > 20 && (
                      <div className="p-3 text-center border-t border-slate-800">
                        <button
                          onClick={() => setShowAllMovs(!showAllMovs)}
                          className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mx-auto"
                        >
                          {showAllMovs ? (
                            <><ChevronRight className="h-4 w-4 rotate-90" /> Mostrar menos</>
                          ) : (
                            <><ChevronDown className="h-4 w-4" /> Ver todos ({timeline.length} movimientos)</>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Lista de gastos ── */}
          {activeTab === 'gastos' && (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-0">
                {data.gastos.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-10">No hay gastos registrados</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="text-slate-400">Fecha</TableHead>
                        <TableHead className="text-slate-400">Descripción</TableHead>
                        <TableHead className="text-slate-400">Categoría</TableHead>
                        <TableHead className="text-slate-400 text-right">Monto</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.gastos.map((g) => (
                        <TableRow key={g.id} className="border-slate-800 hover:bg-slate-800/50">
                          <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                            {formatDate(g.date)}
                          </TableCell>
                          <TableCell>
                            <p className="text-white text-sm">{g.description}</p>
                            {g.notes && <p className="text-slate-500 text-xs mt-0.5">{g.notes}</p>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[g.category]}`}>
                              <Tag className="h-3 w-3 mr-1" />
                              {CATEGORY_LABELS[g.category].split(' ')[1]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-rose-400 text-sm">
                            {formatCurrency(g.amount)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteGasto(g.id)}
                              disabled={isPending}
                              className="h-7 w-7 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
