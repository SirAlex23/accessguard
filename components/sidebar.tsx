'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Shield, LayoutDashboard, Users, Database,
  Key, AlertTriangle, RefreshCw, FileText, LogOut, Bot
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/employees', label: 'Empleados', icon: Users },
  { href: '/dashboard/resources', label: 'Recursos', icon: Database },
  { href: '/dashboard/permissions', label: 'Permisos', icon: Key },
  { href: '/dashboard/shadow-it', label: 'Shadow IT', icon: AlertTriangle },
  { href: '/dashboard/recertification', label: 'Recertificación', icon: RefreshCw },
  { href: '/dashboard/audit', label: 'Audit Log', icon: FileText },
  { href: '/dashboard/ai-advisor', label: 'AI Advisor', icon: Bot },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
        <Shield className="h-6 w-6 text-blue-500" />
        <span className="font-bold text-white text-lg">AccessGuard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}