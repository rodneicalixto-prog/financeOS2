import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Quando o app está cru (logo após Vercel importar do template, antes do
// wizard /setup rodar), as envs Vite ainda estão vazias. Neste estado:
//   - exportamos um stub que falha em qualquer chamada com mensagem clara
//   - App.tsx detecta isUninitialized e força redirect para /setup
//
// Depois que o wizard chama upsertEnv no Vercel + redeploy, esta condição
// fica false e o cliente real é usado normalmente.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function makeUninitializedStub(): SupabaseClient {
  const handler: ProxyHandler<object> = {
    get() {
      throw new Error(
        'Supabase ainda não foi configurado. Complete o wizard em /setup antes de usar o app.',
      )
    },
  }
  return new Proxy({}, handler) as unknown as SupabaseClient
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : makeUninitializedStub()
