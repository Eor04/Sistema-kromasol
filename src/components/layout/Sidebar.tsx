'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
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
  { href: '/compras', label: 'Compras', icon: ShoppingCart },
  { href: '/ventas', label: 'Ventas', icon: TrendingUp },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/kardex', label: 'Kardex', icon: BookOpen },
  { href: '/caja', label: 'Caja', icon: Wallet },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 border-r border-slate-700/50 shadow-2xl">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-700/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white overflow-hidden shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kromasol-logo.png"
            alt="Kromasol Logo"
            className="w-8 h-8 object-contain"
          />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">N & M by Kromasol</h1>
          <p className="text-xs text-slate-400">Sistema de Gestión</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              <span>{label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-500 text-center">
          © 2025 Kromasol v1.0
        </p>
      </div>
    </aside>
  )
}
