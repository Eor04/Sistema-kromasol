'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Users,
  Package,
  BookOpen,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/compras',   label: 'Compras',   icon: ShoppingCart },
  { href: '/ventas',    label: 'Ventas',    icon: TrendingUp },
  { href: '/clientes',  label: 'Clientes',  icon: Users },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/kardex',    label: 'Kardex',    icon: BookOpen },
  { href: '/caja',      label: 'Caja',      icon: Wallet },
]

// Items que se muestran en el bottom nav mobile (los más usados)
const BOTTOM_NAV_ITEMS = ['/dashboard', '/ventas', '/compras', '/clientes', '/caja']
const bottomItems = navItems.filter((i) => BOTTOM_NAV_ITEMS.includes(i.href))

export function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* ── Sidebar desktop (≥ lg) ── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 border-r border-slate-700/50 shadow-2xl">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-700/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white overflow-hidden shadow-md shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kromasol-logo.png" alt="Kromasol Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">N & M by Kromasol</h1>
            <p className="text-xs text-slate-400">Sistema de Gestión</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                )} />
                <span>{label}</span>
                {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">© 2025 Kromasol v1.0</p>
        </div>
      </aside>

      {/* ── Header mobile (< lg) ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white overflow-hidden shadow-md shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kromasol-logo.png" alt="Kromasol Logo" className="w-6 h-6 object-contain" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">N & M by Kromasol</p>
          <p className="text-xs text-slate-400 leading-none mt-0.5">Sistema de Gestión</p>
        </div>
        {/* Nombre de la página activa */}
        <div className="ml-auto">
          {navItems.find((i) => pathname === i.href || pathname.startsWith(i.href + '/')) && (
            <span className="text-xs text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded-lg">
              {navItems.find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.label}
            </span>
          )}
        </div>
      </header>

      {/* ── Bottom navigation mobile (< lg) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 safe-area-pb">
        <div className="flex items-center justify-around px-2 py-2">
          {bottomItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[52px]',
                  isActive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-emerald-400' : 'text-slate-500')} />
                <span className={cn('text-[10px] font-medium leading-none', isActive ? 'text-emerald-400' : 'text-slate-500')}>
                  {label}
                </span>
                {isActive && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400" />}
              </Link>
            )
          })}
          {/* Botón "más" para Kardex y Productos */}
          <MoreMenu pathname={pathname} />
        </div>
      </nav>
    </>
  )
}

// Mini menú para los items que no caben en el bottom nav
function MoreMenu({ pathname }: { pathname: string }) {
  const extraItems = navItems.filter((i) => !BOTTOM_NAV_ITEMS.includes(i.href))
  const isActiveExtra = extraItems.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
  const [open, setOpen] = require('react').useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p: boolean) => !p)}
        className={cn(
          'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[52px]',
          isActiveExtra ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300'
        )}
      >
        <Package className={cn('h-5 w-5', isActiveExtra ? 'text-emerald-400' : 'text-slate-500')} />
        <span className={cn('text-[10px] font-medium leading-none', isActiveExtra ? 'text-emerald-400' : 'text-slate-500')}>
          Más
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Menu popup */}
          <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 min-w-[140px]">
            {extraItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                    isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300 hover:bg-slate-700'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
