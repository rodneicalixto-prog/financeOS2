// =============================================================================
// setup.config.ts — Manifesto do wizard /setup
// -----------------------------------------------------------------------------
// Este é o ÚNICO arquivo que muda entre ferramentas Agentise. Toda a infra
// do wizard (steps, bootstrap, encrypt, app_settings, redeploy) é genérica e
// consome este manifesto.
//
// Para FinanceOS, declaramos quais credenciais de aplicação o wizard precisa
// coletar do aluno no Step 4. As 4 envs core (SUPABASE_*) e CRYPTO_KEY são
// tratadas pelo bootstrap; CRON_SECRET é gerado automaticamente; APP_URL é
// preenchido do deployment final. Tudo aqui é credencial de TERCEIRO.
// =============================================================================

export type ValidationResult = { ok: boolean; message?: string };

export type CredentialField = {
  key: string;
  label: string;
  helpText?: string;
  docsUrl?: string;
  placeholder?: string;
  inputType?: 'text' | 'password' | 'url';
  /**
   * Pode ser chamado tanto no cliente (validação inline) quanto no server
   * (defesa em profundidade na API route). Use endpoints públicos sempre que
   * possível e respeite CORS — quando uma API não permite ping CORS, valide
   * apenas pelo formato e deixe o erro real aparecer no primeiro uso.
   */
  validate: (value: string) => Promise<ValidationResult>;
  optional?: boolean;
};

export type SetupConfig = {
  toolName: string;
  toolSlug: string;
  appCredentials: CredentialField[];
  postBootstrapRedirect: string;
};

// -----------------------------------------------------------------------------
// Helpers de validação reutilizáveis
// -----------------------------------------------------------------------------

const formatOk = (regex: RegExp, message: string) =>
  async (value: string): Promise<ValidationResult> =>
    regex.test(value) ? { ok: true } : { ok: false, message };

// Validação real via fetch + fallback de formato. Algumas APIs bloqueiam CORS
// do browser — nesse caso retornamos { ok: true } se o formato bate, e a
// validação efetiva acontece server-side em /api/credentials.
async function pingOpenAI(value: string): Promise<ValidationResult> {
  if (!value.startsWith('sk-') || value.length < 20) {
    return { ok: false, message: 'A chave da OpenAI deve começar com "sk-" e ter pelo menos 20 caracteres.' };
  }
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${value}` },
    });
    if (res.status === 401) return { ok: false, message: 'Chave inválida ou revogada.' };
    if (!res.ok && res.status !== 200) return { ok: false, message: `OpenAI respondeu ${res.status}.` };
    return { ok: true };
  } catch {
    // CORS ou rede — aceita pelo formato e deixa server validar.
    return { ok: true };
  }
}

// -----------------------------------------------------------------------------
// Manifesto FinanceOS
// -----------------------------------------------------------------------------

export const setupConfig: SetupConfig = {
  toolName: 'FinanceOS',
  toolSlug: 'financeos',
  postBootstrapRedirect: '/',

  appCredentials: [
    {
      key: 'openai_api_key',
      label: 'OpenAI API Key',
      placeholder: 'sk-...',
      inputType: 'password',
      docsUrl: 'https://platform.openai.com/api-keys',
      helpText:
        'Usada pela IA do FinanceOS para parsear emails bancários, detectar assinaturas e gerar insights. Crie em platform.openai.com → API keys e garanta que sua conta tem crédito em platform.openai.com/billing.',
      validate: pingOpenAI,
    },
    {
      key: 'gmail_client_id',
      label: 'Gmail OAuth Client ID',
      placeholder: '1234567890-abc...apps.googleusercontent.com',
      inputType: 'text',
      docsUrl: 'https://console.cloud.google.com/apis/credentials',
      helpText:
        'Crie em console.cloud.google.com → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application. O Client ID é semi-público (aparece na URL OAuth).',
      validate: formatOk(
        /\.apps\.googleusercontent\.com$/,
        'Client ID OAuth termina em ".apps.googleusercontent.com".',
      ),
    },
    {
      key: 'gmail_client_secret',
      label: 'Gmail OAuth Client Secret',
      placeholder: 'GOCSPX-...',
      inputType: 'password',
      docsUrl: 'https://console.cloud.google.com/apis/credentials',
      helpText:
        'Exibido apenas no momento de criação da OAuth Client. Se perdeu, abra a credencial no Google Cloud Console e clique em "Reset secret".',
      validate: formatOk(/^.{12,}$/, 'O Client Secret tem pelo menos 12 caracteres.'),
    },
    {
      key: 'gmail_redirect_uri',
      label: 'Gmail OAuth Redirect URI',
      placeholder: 'https://seu-dominio.vercel.app/auth/gmail/callback',
      inputType: 'url',
      docsUrl: 'https://console.cloud.google.com/apis/credentials',
      helpText:
        'Mesmo valor configurado em "Authorized redirect URIs" no Google Cloud. Em produção, use a URL final da Vercel terminada em /auth/gmail/callback.',
      validate: formatOk(
        /^https?:\/\/.+\/auth\/gmail\/callback\/?$/,
        'A URL precisa terminar em "/auth/gmail/callback".',
      ),
    },
  ],
};
