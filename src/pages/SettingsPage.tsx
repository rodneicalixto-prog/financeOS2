import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { BankAccountsSettings } from '@/components/settings/BankAccountsSettings'
import { GmailSettings } from '@/components/settings/GmailSettings'
import { AISettings } from '@/components/settings/AISettings'
import { CategoriesSettings } from '@/components/settings/CategoriesSettings'
import { TagsSettings } from '@/components/settings/TagsSettings'
import { BudgetsSettings } from '@/components/settings/BudgetsSettings'
import { ExportSettings } from '@/components/settings/ExportSettings'
import { BrandingSettings } from '@/components/settings/BrandingSettings'

type SettingsTab = 'contas' | 'gmail' | 'ia' | 'categorias' | 'tags' | 'orcamentos' | 'exportacao' | 'marca'

const tabs: { key: SettingsTab; label: string }[] = [
  { key: 'contas', label: 'Contas' },
  { key: 'gmail', label: 'Gmail' },
  { key: 'ia', label: 'IA' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'tags', label: 'Tags' },
  { key: 'orcamentos', label: 'Orçamentos' },
  { key: 'exportacao', label: 'Exportação' },
  { key: 'marca', label: 'Marca' },
]

const validTabs: SettingsTab[] = ['contas', 'gmail', 'ia', 'categorias', 'tags', 'orcamentos', 'exportacao', 'marca']

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as SettingsTab | null
  const activeTab: SettingsTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'contas'

  function setActiveTab(tab: SettingsTab) {
    setSearchParams({ tab })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-label-upper mb-1">Configurações</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">Preferências</h1>
        <p className="mt-1 text-sm text-slate-400">
          Gerencie suas contas, categorias e integrações
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(15,18,35,0.4)] p-1.5 backdrop-blur-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300',
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                : 'text-slate-400 hover:bg-[rgba(59,130,246,0.06)] hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'contas' && <BankAccountsSettings />}
        {activeTab === 'gmail' && <GmailSettings />}
        {activeTab === 'ia' && <AISettings />}
        {activeTab === 'categorias' && <CategoriesSettings />}
        {activeTab === 'tags' && <TagsSettings />}
        {activeTab === 'orcamentos' && <BudgetsSettings />}
        {activeTab === 'exportacao' && <ExportSettings />}
        {activeTab === 'marca' && <BrandingSettings />}
      </div>
    </div>
  )
}
