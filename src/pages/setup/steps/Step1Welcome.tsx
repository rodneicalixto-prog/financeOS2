import { ArrowUpRight } from 'lucide-react'
import { WizardLayout } from '../components/WizardLayout'

interface Item {
  num: number
  title: string
  description: string
  url: string
  pills: string[]
}

const ITEMS: Item[] = [
  {
    num: 1,
    title: 'Criar projeto Supabase',
    description:
      'Acesse o Dashboard, clique em New project, escolha a região mais próxima e defina uma senha forte. Aguarde ~2 minutos enquanto provisiona.',
    url: 'https://supabase.com/dashboard/new',
    pills: ['SUPABASE_URL', 'ANON_KEY', 'SERVICE_ROLE'],
  },
  {
    num: 2,
    title: 'Gerar Personal Access Token Supabase',
    description:
      'Em Dashboard → Account → Tokens, clique em Generate new token, dê o nome "FinanceOS Setup" e copie o sbp_… — só aparece uma vez.',
    url: 'https://supabase.com/dashboard/account/tokens',
    pills: ['SUPABASE_PAT'],
  },
  {
    num: 3,
    title: 'Gerar Vercel Token',
    description:
      'Em Vercel → Account Settings → Tokens, clique em Create Token. Scope: full account, expiração 30 dias. Copie o valor.',
    url: 'https://vercel.com/account/tokens',
    pills: ['VERCEL_TOKEN'],
  },
]

export function Step1Welcome({ onNext }: { onNext: () => void }) {
  return (
    <WizardLayout
      step={1}
      title="Vamos configurar o FinanceOS"
      subtitle="Em 5 minutos seu app estará pronto. Você não vai precisar abrir terminal, editar arquivo ou rodar comando — tudo acontece aqui."
      footer={
        <>
          <span className="hidden sm:block" />
          <button type="button" className="wizard-cta" onClick={onNext}>
            Já tenho tudo, continuar
          </button>
        </>
      }
    >
      <p className="mb-6 text-sm text-slate-300">
        Antes de avançar, deixe estas 3 abas abertas no navegador. Você vai colar as credenciais delas
        no próximo passo:
      </p>

      <ol className="space-y-3">
        {ITEMS.map((item) => (
          <li key={item.num} className="wizard-inner-card">
            <div className="flex gap-4">
              <div className="wizard-inner-num">{item.num}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wizard-open-link shrink-0"
                  >
                    abrir <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{item.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.pills.map((p) => (
                    <span key={p} className="wizard-pill">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </WizardLayout>
  )
}
