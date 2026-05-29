import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Kromasol — Sistema de Gestión',
    template: '%s | Kromasol',
  },
  description: 'Sistema de Gestión de Inventario y Ventas para Productos Kromasol',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-950 text-slate-50">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
