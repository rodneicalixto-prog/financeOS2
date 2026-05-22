import { useState } from 'react'
import { Menu, LogOut, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { AlertsDropdown } from '@/components/dashboard/AlertsDropdown'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      await supabase.functions.invoke('sync-emails')
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['transactions-all'] })
      await queryClient.invalidateQueries({ queryKey: ['ai-insights'] })
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <header className="glass-header sticky top-0 z-30 flex h-16 items-center justify-between px-4 lg:px-8">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-400 hover:bg-[rgba(59,130,246,0.08)] hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg p-2 text-slate-400 hover:bg-[rgba(59,130,246,0.08)] hover:text-accent-blue-light transition-colors disabled:opacity-50"
          title="Sincronizar agora"
        >
          <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
        </button>

        {/* Alerts */}
        <AlertsDropdown />

        {/* User */}
        <div className="ml-2 flex items-center gap-3 border-l border-[rgba(59,130,246,0.12)] pl-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-slate-100">
              {user?.user_metadata?.['name'] || user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg p-2 text-slate-400 hover:bg-[rgba(239,68,68,0.1)] hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
