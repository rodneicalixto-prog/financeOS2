import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Settings,
  X,
  DollarSign,
  Users,
  Mail,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useBranding, DEFAULT_BRANDING } from '@/hooks/useBranding'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const baseNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
  { to: '/emails-analisados', label: 'Emails analisados', icon: Mail },
]

const ownerNavItems = [{ to: '/equipe', label: 'Equipe', icon: Users }]

const tailNavItems = [{ to: '/configuracoes', label: 'Configurações', icon: Settings }]

export function Sidebar({ open, onClose }: SidebarProps) {
  const { data: currentUser } = useCurrentUser()
  const { data: branding = DEFAULT_BRANDING } = useBranding()
  const navItems = [
    ...baseNavItems,
    ...(currentUser?.role === 'owner' ? ownerNavItems : []),
    ...tailNavItems,
  ]

  return (
    <>
      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'glass-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-[rgba(59,130,246,0.08)]">
          <div className="flex items-center gap-2.5 min-w-0">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.app_name}
                className="h-9 w-9 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.35)]"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary-dark), var(--brand-primary))' }}
              >
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            )}
            <span className="truncate text-lg font-bold tracking-tight text-white">{branding.app_name}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1.5 px-3 py-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300',
                  isActive
                    ? 'bg-gradient-to-r from-[rgba(59,130,246,0.18)] to-[rgba(59,130,246,0.04)] text-accent-blue-light border border-[rgba(59,130,246,0.25)] shadow-[0_0_20px_rgba(59,130,246,0.08)]'
                    : 'text-slate-400 hover:bg-[rgba(59,130,246,0.06)] hover:text-white border border-transparent'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-[rgba(59,130,246,0.08)] px-6 py-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">{branding.app_name} v1.0</p>
        </div>
      </aside>
    </>
  )
}
