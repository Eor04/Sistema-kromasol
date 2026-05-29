'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Users, Phone, Wallet,
  CheckCircle2, CreditCard, Search, ChevronDown, ChevronRight,
  BadgeCheck, AlertCircle, MessageCircle, Scissors,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  createCustomer, updateCustomer, deleteCustomer,
  getClienteCreditos, registrarCuotas, confirmarCuota, pagarDeudaTotal,
} from '@/actions/customer.actions'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Customer = {
  id: number
  name: string
  phone: string | null
  totalDebt: number
  _count: { sales: number }
}

type Cuota = {
  id: number
  numeroCuota: number
  monto: number
  estado: 'PENDIENTE' | 'PAGADA'
  fechaPago: Date | null
}

type SaleCredito = {
  id: number
  date: Date
  totalAmount: number
  cuotas: Cuota[]
  details: { id: number; quantity: number; unitPrice: number; variant: { presentation: string; product: { name: string } } }[]
}

// ─── WhatsApp helper ──────────────────────────────────────────────────────────

function cleanPhone(phone: string): string {
  // Quita espacios, guiones, paréntesis. Si empieza con 0 (Bolivia), cambia a +591
  let p = phone.replace(/[\s\-().]/g, '')
  if (p.startsWith('0')) p = '591' + p.slice(1)
  if (p.startsWith('+')) p = p.slice(1)
  return p
}

function whatsappUrl(phone: string, name: string): string {
  const p = cleanPhone(phone)
  const msg = encodeURIComponent(`Hola ${name}, te contactamos de N & M by Kromasol 👋`)
  return `https://wa.me/${p}?text=${msg}`
}

// ─── ClientesClient ───────────────────────────────────────────────────────────

export function ClientesClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form cliente
  const [open, setOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [search, setSearch] = useState('')

  // Modal pagos
  const [payModal, setPayModal] = useState<Customer | null>(null)
  const [creditos, setCreditos] = useState<SaleCredito[]>([])
  const [loadingCreditos, setLoadingCreditos] = useState(false)
  const [expandedSale, setExpandedSale] = useState<number | null>(null)

  // Cuotas
  const [cuotasMode, setCuotasMode] = useState<'total' | 'cuotas'>('total')
  const [numCuotas, setNumCuotas] = useState(2)
  const [cuotasInput, setCuotasInput] = useState<Record<number, Record<number, string>>>({})
  const [showCuotasFor, setShowCuotasFor] = useState<number | null>(null)

  const filtered = initialCustomers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── CRUD básico ──
  const openCreate = () => { setEditingCustomer(null); setName(''); setPhone(''); setOpen(true) }
  const openEdit = (c: Customer) => { setEditingCustomer(c); setName(c.name); setPhone(c.phone ?? ''); setOpen(true) }

  const handleSave = () => {
    if (!name.trim()) return toast.error('El nombre es requerido')
    startTransition(async () => {
      const payload = { name: name.trim(), phone: phone.trim() }
      const result = editingCustomer ? await updateCustomer(editingCustomer.id, payload) : await createCustomer(payload)
      if (result.success) { toast.success(editingCustomer ? 'Cliente actualizado' : 'Cliente creado'); setOpen(false); router.refresh() }
      else toast.error(result.error)
    })
  }

  const handleDelete = (id: number) => {
    startTransition(async () => {
      const result = await deleteCustomer(id)
      if (result.success) { toast.success('Cliente eliminado'); router.refresh() }
      else toast.error(result.error)
    })
  }

  // ── Abrir modal de pagos ──
  const openPayModal = async (c: Customer) => {
    setPayModal(c)
    setLoadingCreditos(true)
    setCuotasMode('total')
    setExpandedSale(null)
    setShowCuotasFor(null)
    const result = await getClienteCreditos(c.id)
    if (result.success && result.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCreditos(result.data as any)
    }
    setLoadingCreditos(false)
  }

  // ── Pagar todo de golpe ──
  const handlePagarTodo = () => {
    if (!payModal) return
    startTransition(async () => {
      const result = await pagarDeudaTotal(payModal.id)
      if (result.success) {
        toast.success(`✅ Deuda saldada — ${formatCurrency(result.montoPagado ?? 0)} cobrado`)
        setPayModal(null)
        router.refresh()
      } else toast.error(result.error)
    })
  }

  // ── Registrar cuotas para una venta ──
  const handleRegistrarCuotas = (saleId: number, total: number) => {
    const montos: { numeroCuota: number; monto: number }[] = []
    const saleInput = cuotasInput[saleId] ?? {}
    let suma = 0
    for (let i = 1; i <= numCuotas; i++) {
      const m = parseFloat(saleInput[i] || '0')
      if (m <= 0) return toast.error(`Ingresa el monto de la cuota ${i}`)
      suma += m
      montos.push({ numeroCuota: i, monto: m })
    }
    if (Math.abs(suma - total) > 0.01) return toast.error(`La suma de cuotas (${formatCurrency(suma)}) no coincide con el total (${formatCurrency(total)})`)

    startTransition(async () => {
      const result = await registrarCuotas(saleId, montos)
      if (result.success) {
        toast.success('Cuotas registradas')
        const r2 = await getClienteCreditos(payModal!.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (r2.success && r2.data) setCreditos(r2.data as any)
        setShowCuotasFor(null)
      } else toast.error(result.error)
    })
  }

  // ── Confirmar cuota individual ──
  const handleConfirmarCuota = (cuotaId: number) => {
    startTransition(async () => {
      const result = await confirmarCuota(cuotaId)
      if (result.success) {
        toast.success(`✅ Cuota confirmada — ${formatCurrency(result.monto ?? 0)}`)
        const r2 = await getClienteCreditos(payModal!.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (r2.success && r2.data) setCreditos(r2.data as any)
        router.refresh()
      } else toast.error(result.error)
    })
  }

  // ── Distribuir cuota equitativamente ──
  const distribuirEquitativo = (saleId: number, total: number) => {
    const porCuota = (total / numCuotas).toFixed(2)
    const newInput: Record<number, string> = {}
    for (let i = 1; i <= numCuotas; i++) newInput[i] = porCuota
    setCuotasInput((prev) => ({ ...prev, [saleId]: newInput }))
  }

  const totalDebt = initialCustomers.reduce((s, c) => s + c.totalDebt, 0)

  return (
    <div className="space-y-8">
      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Clientes</h1>
          <p className="text-slate-400 mt-1">Gestión de clientes, deudas y cobros</p>
        </div>
        <Button id="btn-new-customer" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>

        {/* Dialog crear/editar cliente */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Nombre *</Label>
                <Input id="customer-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre completo" className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Teléfono (WhatsApp)</Label>
                <Input id="customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+591 7XXXXXXX" className="bg-slate-800 border-slate-700 text-white" />
                <p className="text-slate-500 text-xs">Incluye el código de país para WhatsApp (ej. +591 para Bolivia)</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} className="text-slate-400">Cancelar</Button>
              <Button id="save-customer" onClick={handleSave} disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500">
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-slate-400">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-400">{initialCustomers.length}</p></CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-slate-400">Deuda Total</CardTitle>
            <Wallet className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-400">{formatCurrency(totalDebt)}</p></CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-slate-400">Con Deuda</CardTitle>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-400">{initialCustomers.filter((c) => c.totalDebt > 0).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabla ── */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input id="search-customers" placeholder="Buscar cliente..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Nombre</TableHead>
                <TableHead className="text-slate-400">Teléfono</TableHead>
                <TableHead className="text-slate-400 text-center">Ventas</TableHead>
                <TableHead className="text-slate-400 text-right">Deuda</TableHead>
                <TableHead className="text-slate-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-10">No se encontraron clientes</TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="border-slate-800 hover:bg-slate-800/50">
                    {/* Nombre */}
                    <TableCell className="text-white font-medium">
                      <div className="flex items-center gap-2">
                        {c.name}
                        {c.totalDebt > 0 && (
                          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-600/30 text-xs">
                            Pendiente
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Teléfono + WhatsApp */}
                    <TableCell className="text-slate-400 text-sm">
                      {c.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{c.phone}</span>
                          <a
                            href={whatsappUrl(c.phone, c.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir chat de WhatsApp"
                            className="text-[#25D366] hover:text-[#128C7E] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* WhatsApp SVG icon */}
                            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.847L0 24l6.335-1.508A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 01-5.001-1.367l-.36-.213-3.733.888.929-3.64-.235-.374A9.818 9.818 0 012.182 12C2.182 6.578 6.578 2.182 12 2.182c5.422 0 9.818 4.396 9.818 9.818 0 5.423-4.396 9.818-9.818 9.818z"/>
                            </svg>
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </TableCell>

                    {/* Ventas */}
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-slate-700 text-slate-300">{c._count.sales}</Badge>
                    </TableCell>

                    {/* Deuda */}
                    <TableCell className="text-right">
                      <Badge variant="outline" className={c.totalDebt > 0 ? 'border-amber-500 text-amber-400' : 'border-emerald-600 text-emerald-400'}>
                        {formatCurrency(c.totalDebt)}
                      </Badge>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Botón cobrar (solo si tiene deuda) */}
                        {c.totalDebt > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPayModal(c)}
                            className="border-amber-600 text-amber-400 hover:bg-amber-600/10 text-xs h-8"
                            title="Gestionar cobro"
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Cobrar
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}
                          className="text-slate-400 hover:text-white hover:bg-slate-700 h-8 w-8">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)} disabled={isPending}
                          className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 h-8 w-8">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Modal de Cobro / Cuotas ── */}
      <Dialog open={!!payModal} onOpenChange={() => setPayModal(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          {payModal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-xl bg-amber-500/15">
                    <CreditCard className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white">{payModal.name}</p>
                    <p className="text-amber-400 text-sm font-normal">
                      Deuda pendiente: {formatCurrency(payModal.totalDebt)}
                    </p>
                  </div>
                  {payModal.phone && (
                    <a href={whatsappUrl(payModal.phone, payModal.name)} target="_blank" rel="noopener noreferrer"
                      className="ml-auto text-[#25D366] hover:text-[#128C7E] transition-colors" title="WhatsApp">
                      <MessageCircle className="h-6 w-6" />
                    </a>
                  )}
                </DialogTitle>
              </DialogHeader>

              {loadingCreditos ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-5 mt-2">
                  {/* Botón pago total rápido */}
                  <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">Pago completo</p>
                      <p className="text-slate-400 text-sm">Saldar toda la deuda de una vez</p>
                    </div>
                    <Button
                      onClick={handlePagarTodo}
                      disabled={isPending}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Pagó todo — {formatCurrency(payModal.totalDebt)}
                    </Button>
                  </div>

                  {/* Ventas a crédito */}
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Ventas a crédito</p>
                    {creditos.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-4">No hay ventas a crédito registradas</p>
                    ) : (
                      <div className="space-y-3">
                        {creditos.map((sale) => {
                          const totalPagado = sale.cuotas.filter((q) => q.estado === 'PAGADA').reduce((s, q) => s + q.monto, 0)
                          const pendiente = sale.totalAmount - totalPagado
                          const hasCuotas = sale.cuotas.length > 0

                          return (
                            <div key={sale.id} className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
                              {/* Header de la venta */}
                              <div
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                                onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {expandedSale === sale.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                  <div>
                                    <p className="text-white text-sm font-medium">Venta #{sale.id} · {formatDate(sale.date)}</p>
                                    <p className="text-slate-400 text-xs">Total: {formatCurrency(sale.totalAmount)} · Pendiente: <span className={pendiente > 0 ? 'text-amber-400' : 'text-emerald-400'}>{formatCurrency(pendiente)}</span></p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {pendiente <= 0 && <BadgeCheck className="h-5 w-5 text-emerald-400" />}
                                  {hasCuotas && (
                                    <Badge variant="outline" className="border-blue-600 text-blue-400 text-xs">
                                      {sale.cuotas.filter((q) => q.estado === 'PAGADA').length}/{sale.cuotas.length} cuotas
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Detalle expandido */}
                              {expandedSale === sale.id && (
                                <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                                  {/* Productos */}
                                  <div className="space-y-1">
                                    {sale.details.map((d) => (
                                      <div key={d.id} className="flex justify-between text-xs text-slate-400">
                                        <span>{d.variant.product.name} — {d.variant.presentation} × {d.quantity}</span>
                                        <span>{formatCurrency(d.quantity * d.unitPrice)}</span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Cuotas existentes */}
                                  {hasCuotas && (
                                    <div className="space-y-2">
                                      <p className="text-slate-400 text-xs uppercase tracking-wider">Cuotas</p>
                                      {sale.cuotas.map((q) => (
                                        <div key={q.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                                          <div>
                                            <p className="text-white text-xs font-medium">Cuota {q.numeroCuota} — {formatCurrency(q.monto)}</p>
                                            {q.estado === 'PAGADA' && q.fechaPago && (
                                              <p className="text-emerald-400 text-xs">Pagada el {formatDate(q.fechaPago)}</p>
                                            )}
                                          </div>
                                          {q.estado === 'PENDIENTE' ? (
                                            <Button
                                              size="sm"
                                              onClick={() => handleConfirmarCuota(q.id)}
                                              disabled={isPending}
                                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7"
                                            >
                                              <CheckCircle2 className="h-3 w-3 mr-1" />
                                              Confirmar pago
                                            </Button>
                                          ) : (
                                            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-600/30 text-xs gap-1">
                                              <BadgeCheck className="h-3 w-3" /> Pagada
                                            </Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Definir cuotas (si no tiene aún o quiere redefinir) */}
                                  {pendiente > 0 && showCuotasFor !== sale.id && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => { setShowCuotasFor(sale.id); distribuirEquitativo(sale.id, pendiente) }}
                                      className="border-blue-600 text-blue-400 hover:bg-blue-600/10 text-xs w-full"
                                    >
                                      <Scissors className="h-3 w-3 mr-1" />
                                      {hasCuotas ? 'Redefinir cuotas' : 'Dividir en cuotas'}
                                    </Button>
                                  )}

                                  {/* Panel de definición de cuotas */}
                                  {showCuotasFor === sale.id && (
                                    <div className="bg-slate-700/40 rounded-xl p-3 space-y-3 border border-blue-700/30">
                                      <div className="flex items-center justify-between">
                                        <p className="text-blue-400 text-xs font-medium uppercase tracking-wider">Dividir {formatCurrency(pendiente)} en cuotas</p>
                                        <div className="flex items-center gap-2">
                                          <Label className="text-slate-400 text-xs">Nº cuotas:</Label>
                                          <div className="flex gap-1">
                                            {[2, 3, 4].map((n) => (
                                              <button
                                                key={n}
                                                onClick={() => { setNumCuotas(n); distribuirEquitativo(sale.id, pendiente) }}
                                                className={`w-7 h-7 rounded-md text-xs font-medium transition-all ${numCuotas === n ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                              >
                                                {n}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        {Array.from({ length: numCuotas }, (_, i) => i + 1).map((n) => (
                                          <div key={n} className="space-y-1">
                                            <Label className="text-slate-400 text-xs">Cuota {n} (Bs.)</Label>
                                            <Input
                                              type="number"
                                              min="0.01"
                                              step="0.01"
                                              value={cuotasInput[sale.id]?.[n] ?? ''}
                                              onChange={(e) => setCuotasInput((p) => ({
                                                ...p,
                                                [sale.id]: { ...p[sale.id], [n]: e.target.value }
                                              }))}
                                              className="bg-slate-700 border-slate-600 text-white h-8 text-sm"
                                            />
                                          </div>
                                        ))}
                                      </div>

                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() => distribuirEquitativo(sale.id, pendiente)}
                                          variant="outline"
                                          className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs flex-1"
                                        >
                                          Distribuir equitativamente
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleRegistrarCuotas(sale.id, pendiente)}
                                          disabled={isPending}
                                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs flex-1"
                                        >
                                          Guardar cuotas
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setShowCuotasFor(null)}
                                          className="text-slate-400 text-xs">Cancelar</Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setPayModal(null)} className="text-slate-400">Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
