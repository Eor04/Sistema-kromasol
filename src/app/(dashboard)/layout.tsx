import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      {/* Contenido principal */}
      <main className={[
        // Desktop: offset del sidebar izquierdo
        'lg:ml-64',
        // Mobile: padding para el header superior y bottom nav
        'pt-16 pb-24 lg:pt-0 lg:pb-0',
        'overflow-y-auto',
      ].join(' ')}>
        <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl">
          {children}
        </div>
      </main>
    </div>
  )
}
