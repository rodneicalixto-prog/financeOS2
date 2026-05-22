import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

interface CnpjData {
  cnpj: string
  company_name: string
  main_activity: string
  category_suggestion: string
  raw_data: Record<string, unknown>
  fetched_at: string
}

// Mapa CNAE → Categoria do FinanceOS
const CNAE_CATEGORY_MAP: Record<string, string> = {
  'alimentação': 'Alimentação',
  'restaurante': 'Alimentação',
  'lanchonete': 'Alimentação',
  'supermercado': 'Alimentação',
  'padaria': 'Alimentação',
  'transporte': 'Transporte',
  'combustível': 'Transporte',
  'estacionamento': 'Transporte',
  'saúde': 'Saúde',
  'farmácia': 'Saúde',
  'hospital': 'Saúde',
  'clínica': 'Saúde',
  'aluguel': 'Moradia',
  'imobiliária': 'Moradia',
  'condomínio': 'Moradia',
  'educação': 'Educação',
  'escola': 'Educação',
  'curso': 'Educação',
  'entretenimento': 'Lazer',
  'streaming': 'Assinaturas',
  'software': 'Assinaturas',
  'telecomunicações': 'Assinaturas',
}

function suggestCategory(mainActivity: string): string {
  const activityLower = mainActivity.toLowerCase()
  for (const [keyword, category] of Object.entries(CNAE_CATEGORY_MAP)) {
    if (activityLower.includes(keyword)) {
      return category
    }
  }
  return 'Outros'
}

export async function lookupCNPJ(
  cnpj: string,
  supabaseAdmin: SupabaseClient
): Promise<CnpjData | null> {
  // Limpa CNPJ (só dígitos)
  const cleanCnpj = cnpj.replace(/\D/g, '')
  if (cleanCnpj.length !== 14) return null

  // 1. Verifica cache
  const { data: cached } = await supabaseAdmin
    .from('fo_cnpj_cache')
    .select('*')
    .eq('cnpj', cleanCnpj)
    .single()

  if (cached) {
    // Cache válido por 30 dias
    const fetchedAt = new Date(cached.fetched_at as string)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    if (fetchedAt > thirtyDaysAgo) {
      return cached as CnpjData
    }
  }

  // 2. Consulta API pública
  try {
    const response = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`)

    if (!response.ok) {
      console.error(`CNPJ API error: ${response.status} for ${cleanCnpj}`)
      return null
    }

    const data = await response.json()

    const mainActivity =
      data.estabelecimento?.atividade_principal?.descricao ||
      data.atividade_principal?.descricao ||
      ''

    const companyName =
      data.razao_social ||
      data.estabelecimento?.nome_fantasia ||
      ''

    const cnpjData: CnpjData = {
      cnpj: cleanCnpj,
      company_name: companyName,
      main_activity: mainActivity,
      category_suggestion: suggestCategory(mainActivity),
      raw_data: data,
      fetched_at: new Date().toISOString(),
    }

    // 3. Salva no cache
    await supabaseAdmin
      .from('fo_cnpj_cache')
      .upsert(cnpjData, { onConflict: 'cnpj' })

    return cnpjData
  } catch (err) {
    console.error(`CNPJ lookup error for ${cleanCnpj}:`, (err as Error).message)
    return null
  }
}
