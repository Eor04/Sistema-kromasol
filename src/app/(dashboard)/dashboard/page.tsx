import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  TrendingUp, TrendingDown, Users, Package, AlertTriangle,
  ShoppingCart, Wallet, ArrowRight, CheckCircle2, Clock,
  BarChart3, Zap, Star,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

const LOW_STOCK = 20

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDashboardData() {
  const now = new Date()
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  // Últimos 7 días para mini gráfico
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    return d
  })

  const [
    todaySales, monthSales, lastMonthSales,
    totalCustomers, debtAgg,
    lowStockProducts,
    recentSales, recentPurchases,
    allProducts,
    gastos, config, cuotasPendientes,
  ] = await Promise.all([
    // Ventas hoy
    prisma.sale.aggregate({
      where: { date: { gte: startOfToday } },
      _sum: { totalAmount: true }, _count: true,
    }),
    // Ventas este mes
    prisma.sale.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { totalAmount: true }, _count: true,
    }),
    // Ventas mes pasado
    prisma.sale.aggregate({
      where: { date: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { totalAmount: true }, _count: true,
    }),
    // Clientes
    prisma.customer.count(),
    prisma.customer.aggregate({ _sum: { totalDebt: true } }),
    // Stock bajo (productos)
    prisma.product.findMany({
      where: { stockInBaseUnits: { lte: LOW_STOCK } },
      orderBy: { stockInBaseUnits: 'asc' },
      take: 5,
    }),
    // Últimas ventas
    prisma.sale.findMany({
      orderBy: { date: 'desc' }, take: 6,
      include: { customer: { select: { name: true } }, details: true },
    }),
    // Últimas compras
    prisma.purchase.findMany({
      orderBy: { date: 'desc' }, take: 4,
    }),
    // Todos los productos para stock overview
    prisma.product.findMany({
      orderBy: { stockInBaseUnits: 'desc' },
      take: 6,
      include: { variants: { take: 1 } },
    }),
    // Gastos del mes
    prisma.gasto.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { amount: true }, _count: true,
    }),
    // Capital inicial
    prisma.configuracion.findUnique({ where: { id: 1 } }),
    // Cuotas pendientes
    prisma.cuota.count({ where: { estado: 'PENDIENTE' } }),
  ])

  // Ventas por día (últimos 7 días)
  const salesByDay = await Promise.all(
    last7Days.map(async (day) => {
      const next = new Date(day); next.setDate(next.getDate() + 1)
      const agg = await prisma.sale.aggregate({
        where: { date: { gte: day, lt: next } },
        _sum: { totalAmount: true },
      })
      return {
        label: day.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric' }),
        amount: agg._sum.totalAmount ?? 0,
      }
    })
  )

  const thisMonthTotal = monthSales._sum.totalAmount ?? 0
  const lastMonthTotal = lastMonthSales._sum.totalAmount ?? 0
  const growthPct = lastMonthTotal > 0
    ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
    : thisMonthTotal > 0 ? 100 : 0

  const saldoCaja =
    (config?.capitalInicial ?? 0) +
    (monthSales._sum.totalAmount ?? 0) -
    (gastos._sum.amount ?? 0)

  return {
    todayTotal: todaySales._sum.totalAmount ?? 0,
    todayCount: todaySales._count,
    thisMonthTotal,
    lastMonthTotal,
    growthPct,
    totalCustomers,
    totalDebt: debtAgg._sum.totalDebt ?? 0,
    lowStockProducts,
    recentSales,
    recentPurchases,
    allProducts,
    salesByDay,
    gastosMonth: gastos._sum.amount ?? 0,
    saldoCaja,
    cuotasPendientes,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, color, bg, trend, trendLabel, href,
}: {
  title: string; value: string; sub: string
  icon: React.ElementType; color: string; bg: string
  trend?: number; trendLabel?: string; href?: string
}) {
  const inner = (
    <Card className={`bg-slate-900 border-slate-800 hover:border-slate-700 transition-all duration-200 group ${href ? 'cursor-pointer' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(0)}%
            </div>
          )}
        </div>
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{title}</p>
          <p className={`text-2xl font-black ${color}`}>{value}</p>
          <p className="text-slate-500 text-xs mt-1.5">{trendLabel ?? sub}</p>
        </div>
        {href && (
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
            Ver detalle <ArrowRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// Mini bar chart (CSS only)
function MiniBarChart({ data }: { data: { label: string; amount: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.amount), 1)
  return (
    <div className="flex items-end gap-1.5 h-24 mt-2">
      {data.map((d, i) => {
        const isToday = i === data.length - 1
        const pct = Math.max((d.amount / maxVal) * 100, 2)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative flex items-end" style={{ height: '80px' }}>
              <div
                className={`w-full rounded-t-md transition-all duration-700 ${
                  isToday
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                    : d.amount > 0
                    ? 'bg-slate-600 hover:bg-slate-500'
                    : 'bg-slate-800'
                }`}
                style={{ height: `${pct}%` }}
                title={`${d.label}: ${formatCurrency(d.amount)}`}
              />
            </div>
            <span className={`text-[9px] ${isToday ? 'text-emerald-400 font-bold' : 'text-slate-600'} text-center leading-none`}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const data = await getDashboardData()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '☀️ Buenos días' : hour < 18 ? '👋 Buenas tardes' : '🌙 Buenas noches'

  const maxStock = Math.max(...data.allProducts.map((p) => p.stockInBaseUnits), 1)

  return (
    <div className="space-y-6">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 border border-slate-700/50 p-6">
        {/* Glow decorativo */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-5 -left-5 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />

        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-slate-400 text-sm mb-1">{greeting}</p>
            <h1 className="text-3xl font-black text-white tracking-tight">N & M by Kromasol</h1>
            <p className="text-slate-400 mt-1 text-sm">
              {new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/ventas">
              <div className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 transition-colors text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-900/30">
                <Zap className="h-4 w-4" /> Nueva Venta
              </div>
            </Link>
            <Link href="/compras">
              <div className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 transition-colors text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                <ShoppingCart className="h-4 w-4" /> Compra
              </div>
            </Link>
          </div>
        </div>

        {/* Mini stats rápidos */}
        <div className="relative z-10 mt-5 grid grid-cols-3 gap-3">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <p className="text-slate-400 text-xs">Ventas hoy</p>
            <p className="text-white font-bold text-lg">{formatCurrency(data.todayTotal)}</p>
            <p className="text-slate-500 text-xs">{data.todayCount} pedidos</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <p className="text-slate-400 text-xs">Caja (mes)</p>
            <p className={`font-bold text-lg ${data.saldoCaja >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(data.saldoCaja)}
            </p>
            <p className="text-slate-500 text-xs">saldo estimado</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <p className="text-slate-400 text-xs">Cobros pend.</p>
            <p className={`font-bold text-lg ${data.cuotasPendientes > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {data.cuotasPendientes}
            </p>
            <p className="text-slate-500 text-xs">cuotas por cobrar</p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Ventas este mes" value={formatCurrency(data.thisMonthTotal)}
          sub={`vs ${formatCurrency(data.lastMonthTotal)} mes anterior`}
          icon={TrendingUp} color="text-emerald-400" bg="bg-emerald-500/10"
          trend={data.growthPct} trendLabel={`vs mes anterior`} href="/ventas"
        />
        <KpiCard
          title="Deuda total" value={formatCurrency(data.totalDebt)}
          sub={`${data.totalCustomers} clientes`}
          icon={Wallet} color="text-amber-400" bg="bg-amber-500/10"
          href="/clientes"
        />
        <KpiCard
          title="Clientes" value={data.totalCustomers.toString()}
          sub="clientes registrados"
          icon={Users} color="text-blue-400" bg="bg-blue-500/10"
          href="/clientes"
        />
        <KpiCard
          title="Gastos del mes" value={formatCurrency(data.gastosMonth)}
          sub="egresos registrados"
          icon={TrendingDown} color="text-rose-400" bg="bg-rose-500/10"
          href="/caja"
        />
      </div>

      {/* ── Fila principal: Gráfico + Actividad reciente ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Gráfico de ventas (7 días) */}
        <Card className="lg:col-span-3 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                Ventas — últimos 7 días
              </CardTitle>
              <Badge variant="outline" className="border-emerald-700 text-emerald-400 text-xs">
                {formatCurrency(data.thisMonthTotal)} este mes
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={data.salesByDay} />
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Total semana: {formatCurrency(data.salesByDay.reduce((s, d) => s + d.amount, 0))}</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Hoy
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Últimas ventas */}
        <Card className="lg:col-span-2 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-400" />
                Últimas ventas
              </CardTitle>
              <Link href="/ventas" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {data.recentSales.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No hay ventas aún</p>
            ) : (
              data.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      sale.isCredit ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                    }`}>
                      {sale.isCredit
                        ? <Clock className="h-3.5 w-3.5 text-amber-400" />
                        : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">
                        {sale.customer?.name ?? 'Venta directa'}
                      </p>
                      <p className="text-slate-500 text-xs">{formatDate(sale.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${sale.isCredit ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {formatCurrency(sale.totalAmount)}
                    </p>
                    <p className="text-slate-600 text-xs">{sale.details.length} ítem{sale.details.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fila secundaria: Stock + Compras + Alertas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Stock overview */}
        <Card className="lg:col-span-2 bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-blue-400" />
                Inventario — Top productos
              </CardTitle>
              <Link href="/productos" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                Gestionar <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {data.allProducts.map((p) => {
              const pct = Math.max((p.stockInBaseUnits / maxStock) * 100, 1)
              const unit = p.variants[0]?.baseUnitName ?? 'u'
              const isLow = p.stockInBaseUnits <= LOW_STOCK
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{p.name}</span>
                      {isLow && (
                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-600/20 text-xs px-1.5 py-0">
                          Stock bajo
                        </Badge>
                      )}
                    </div>
                    <span className={`text-xs font-bold ${isLow ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {p.stockInBaseUnits} {unit}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isLow ? 'bg-rose-500' : pct > 60 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Panel derecho: alertas + últimas compras */}
        <div className="space-y-4">

          {/* Alertas de stock */}
          <Card className={`border ${data.lowStockProducts.length > 0 ? 'border-rose-800/50 bg-rose-950/20' : 'border-slate-800 bg-slate-900'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className={`h-4 w-4 ${data.lowStockProducts.length > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
                <span className={data.lowStockProducts.length > 0 ? 'text-rose-300' : 'text-slate-400'}>
                  Alertas de stock
                </span>
                {data.lowStockProducts.length > 0 && (
                  <Badge className="bg-rose-500 text-white text-xs ml-auto px-1.5">{data.lowStockProducts.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.lowStockProducts.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs">Todo el inventario OK</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.lowStockProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-rose-200 text-xs">{p.name}</span>
                      <Badge variant="outline" className={`text-xs ${p.stockInBaseUnits === 0 ? 'border-rose-500 text-rose-400' : 'border-amber-600 text-amber-400'}`}>
                        {p.stockInBaseUnits === 0 ? 'AGOTADO' : `${p.stockInBaseUnits} u`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimas compras */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-300 flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4 text-blue-400" />
                  Últimas compras
                </CardTitle>
                <Link href="/compras" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {data.recentPurchases.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-2">Sin compras recientes</p>
              ) : (
                data.recentPurchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
                    <div>
                      <p className="text-slate-300 text-xs font-medium">{p.period}</p>
                      <p className="text-slate-600 text-xs">{formatDate(p.date)}</p>
                    </div>
                    <span className="text-blue-400 text-xs font-semibold">{formatCurrency(p.totalCost)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-3">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                <Star className="h-3 w-3" /> Accesos rápidos
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: '/ventas', label: 'Nueva venta', color: 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' },
                  { href: '/compras', label: 'Registrar compra', color: 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20' },
                  { href: '/clientes', label: 'Clientes', color: 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' },
                  { href: '/caja', label: 'Ver caja', color: 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20' },
                ].map(({ href, label, color }) => (
                  <Link key={href} href={href}>
                    <div className={`rounded-lg p-2.5 text-center text-xs font-medium ${color} transition-colors cursor-pointer`}>
                      {label}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
