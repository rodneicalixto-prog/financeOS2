import { getCredential } from './credentials.ts'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const MAX_RETRIES = 3

export interface AICredential {
  provider: 'openai' | 'gemini'
  apiKey: string
}

interface AIParsedTransaction {
  amount: number
  date: string
  description: string
  type: 'income' | 'expense'
  cnpj: string | null
  counterpart_name: string
}

interface AIParseError {
  error: 'unable_to_parse'
}

type AIParseResult = AIParsedTransaction | AIParseError

const PARSE_SYSTEM_PROMPT = `Você é um parser financeiro. Extraia os dados da transação bancária do email abaixo.
Responda APENAS com JSON válido, sem markdown.

Schema:
{
  "amount": number,
  "date": "YYYY-MM-DD",
  "description": "string",
  "type": "income" | "expense",
  "cnpj": "string | null",
  "counterpart_name": "string"
}

Se não conseguir extrair, retorne: { "error": "unable_to_parse" }`

const RECURRING_SYSTEM_PROMPT = `Analise as transações abaixo e identifique assinaturas/pagamentos recorrentes.
Critérios: mesmo destinatário, valor similar (±10%), periodicidade mensal.
Responda APENAS com JSON: { "recurring": [{ "transaction_ids": string[], "service_name": string, "avg_amount": number, "frequency": "monthly" }] }`

// =============================================
// Credential resolution
// -----------------------------------------------
// Ordem de prioridade:
//   1. credential passada explicitamente (caller decidiu — ex: chave per-user)
//   2. app_settings.openai_api_key (configurada pelo owner no wizard /setup)
//   3. Erro claro pra refazer o setup
// =============================================
async function resolveCredential(credential?: AICredential): Promise<AICredential> {
  if (credential) return credential
  const stored = await getCredential('openai_api_key')
  if (!stored) {
    throw new Error(
      'OpenAI API key não configurada em app_settings. Acesse /configuracoes (owner) para configurar.',
    )
  }
  return { provider: 'openai', apiKey: stored }
}

// =============================================
// OpenAI
// =============================================
async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${errText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenAI')
  return content
}

// =============================================
// Gemini
// =============================================
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${errText}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error('Empty response from Gemini')
  return content
}

// =============================================
// Retry wrapper
// =============================================
export async function callWithRetry(
  cred: AICredential,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
      return cred.provider === 'openai'
        ? await callOpenAI(cred.apiKey, systemPrompt, userContent)
        : await callGemini(cred.apiKey, systemPrompt, userContent)
    } catch (err) {
      lastError = err as Error
      console.error(`AI call attempt ${attempt + 1} failed (${cred.provider}):`, lastError.message)
    }
  }
  throw new Error(`AI call failed after ${MAX_RETRIES} attempts: ${lastError?.message}`)
}

// =============================================
// Prompt: Resumo mensal
// =============================================
export const MONTHLY_SUMMARY_PROMPT = `Você é um consultor financeiro pessoal para empreendedores brasileiros.
Analise os dados financeiros do mês e gere:
1. Um resumo de 2-3 frases curtas
2. Uma lista de insights específicos e acionáveis baseados nos dados

Os insights devem ser observações concretas como:
- Comparação de categorias entre meses ("Seu gasto com Alimentação subiu 25% vs mês passado")
- Transações atípicas ("Gasto pontual de R$5.500 em Lazer — é recorrente?")
- Tendências de receita ("Você recebeu 3 pagamentos via Pix este mês, 2 a mais que o anterior")
- Alertas de orçamento ("Assinaturas somam R$280/mês — considere revisar")
- Qualquer padrão relevante nos dados

Cada insight deve ter um emoji indicando o tipo: 📈 aumento, 📉 redução, ⚠️ alerta, 💡 dica, ✅ positivo.

Responda APENAS com JSON válido, sem markdown:
{
  "summary": "texto do resumo aqui",
  "insights": [
    { "emoji": "📈", "text": "texto do insight" }
  ]
}`

// =============================================
// Prompt: Sugestão de orçamento
// =============================================
export const BUDGET_SUGGESTIONS_PROMPT = `Você é um consultor financeiro para empreendedores brasileiros.
Analise os gastos dos últimos 3 meses por categoria e sugira limites de orçamento mensais realistas.
O limite sugerido deve ser ~10-20% acima da média mensal (margem de segurança).
Inclua uma justificativa curta (1 frase) para cada sugestão.

Responda APENAS com JSON válido, sem markdown:
{
  "suggestions": [
    {
      "category_name": "string",
      "suggested_limit": number,
      "reasoning": "string curta"
    }
  ]
}`

// =============================================
// Parse email
// =============================================
export async function parseEmailWithAI(
  emailContent: string,
  credential?: AICredential
): Promise<AIParseResult> {
  const cred = await resolveCredential(credential)
  const raw = await callWithRetry(
    cred,
    PARSE_SYSTEM_PROMPT,
    emailContent.substring(0, 8000)
  )
  return JSON.parse(raw) as AIParseResult
}

// =============================================
// Detect recurring
// =============================================
export async function detectRecurring(
  transactions: Array<{
    id: string
    description: string
    amount: number
    date: string
    counterpart_name?: string
  }>,
  credential?: AICredential
): Promise<Array<{ transaction_ids: string[]; service_name: string; avg_amount: number; frequency: string }>> {
  const cred = await resolveCredential(credential)
  const raw = await callWithRetry(cred, RECURRING_SYSTEM_PROMPT, JSON.stringify(transactions))
  const parsed = JSON.parse(raw || '{}')
  return parsed.recurring || parsed.recurrences || parsed || []
}
