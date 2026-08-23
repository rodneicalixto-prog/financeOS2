import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { ScannedEmailsPage } from '@/pages/ScannedEmailsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { GmailCallbackPage } from '@/pages/GmailCallbackPage'
import { TeamPage } from '@/pages/TeamPage'
import { InvitePage } from '@/pages/InvitePage'
import { AcceptInvitePage } from '@/pages/AcceptInvitePage'
import { SetupPage } from '@/pages/setup/SetupPage'
import { BrandingProvider } from '@/components/branding/BrandingProvider'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Quando o app está cru (envs Vite vazias logo após import na Vercel), forçamos
// /setup. Após o wizard rodar bootstrap + redeploy, isSupabaseConfigured fica
// true e essa guarda deixa de redirecionar.
function UninitializedGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!isSupabaseConfigured && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />
  }
  return <>{children}</>
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <BrowserRouter>
          <UninitializedGate>
            <Routes>
              <Route path="/setup" element={<SetupPage />} />

              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />

              <Route path="/invite" element={<InvitePage />} />
              <Route path="/aceitar-convite" element={<AcceptInvitePage />} />

              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/auth/gmail/callback" element={<GmailCallbackPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/transacoes" element={<TransactionsPage />} />
                <Route path="/emails-analisados" element={<ScannedEmailsPage />} />
                <Route path="/equipe" element={<TeamPage />} />
                <Route path="/configuracoes" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </UninitializedGate>
        </BrowserRouter>
      </BrandingProvider>
    </QueryClientProvider>
  )
}
