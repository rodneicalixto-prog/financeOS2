import { useEffect, useState, type ChangeEvent } from 'react'
import { Palette, Image as ImageIcon, Sun, Moon, Save, Loader2, CircleAlert } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useBranding, useUpdateBranding, DEFAULT_BRANDING } from '@/hooks/useBranding'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const MAX_IMAGE_BYTES = 500 * 1024 // 500KB — evita linhas gigantes no banco

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function BrandingSettings() {
  const { data: branding, isLoading } = useBranding()
  const { data: currentUser } = useCurrentUser()
  const updateBranding = useUpdateBranding()
  const isOwner = currentUser?.role === 'owner'

  const [appName, setAppName] = useState(DEFAULT_BRANDING.app_name)
  const [logoUrl, setLogoUrl] = useState<string | null>(DEFAULT_BRANDING.logo_url)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(DEFAULT_BRANDING.favicon_url)
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_BRANDING.primary_color)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(DEFAULT_BRANDING.theme_mode)
  const [imageError, setImageError] = useState<string | null>(null)

  useEffect(() => {
    if (!branding) return
    setAppName(branding.app_name)
    setLogoUrl(branding.logo_url)
    setFaviconUrl(branding.favicon_url)
    setPrimaryColor(branding.primary_color)
    setThemeMode(branding.theme_mode)
  }, [branding])

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>, setter: (v: string) => void) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Imagem muito grande. Use um arquivo de até 500KB (PNG/SVG comprimido funciona melhor).')
      e.target.value = ''
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setter(dataUrl)
    } catch {
      setImageError('Não foi possível ler o arquivo. Tente outra imagem.')
    }
    e.target.value = ''
  }

  function handleSave() {
    updateBranding.mutate({
      app_name: appName.trim() || 'FinanceOS',
      logo_url: logoUrl,
      favicon_url: faviconUrl,
      primary_color: primaryColor,
      theme_mode: themeMode,
    })
  }

  if (isLoading) {
    return <Card><p className="text-slate-400">Carregando...</p></Card>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Marca</h3>
        <p className="mt-1 text-sm text-slate-400">
          Personalize nome, logomarca, favicon, cor e tema do FinanceOS. As mudanças valem para
          todos os usuários da instância.
        </p>
      </div>

      {!isOwner && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-accent-yellow">
            <CircleAlert className="h-4 w-4 shrink-0" />
            Apenas o owner da instância pode alterar a marca. Os campos abaixo estão em modo leitura.
          </div>
        </Card>
      )}

      <Card>
        <div className="space-y-5">
          <Input
            label="Nome do app"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            disabled={!isOwner}
            placeholder="FinanceOS"
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <BrandImageField
              label="Logomarca"
              value={logoUrl}
              onUpload={(e) => handleImageUpload(e, setLogoUrl)}
              onClear={() => setLogoUrl(null)}
              disabled={!isOwner}
              round={false}
            />
            <BrandImageField
              label="Favicon"
              value={faviconUrl}
              onUpload={(e) => handleImageUpload(e, setFaviconUrl)}
              onClear={() => setFaviconUrl(null)}
              disabled={!isOwner}
              round
            />
          </div>

          {imageError && <p className="text-xs text-accent-red">{imageError}</p>}

          <div>
            <label className="text-label-upper mb-2 block">Cor primária</label>
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[rgba(59,130,246,0.25)]">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={!isOwner}
                  className="absolute -left-1 -top-1 h-12 w-12 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                />
              </div>
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={!isOwner}
                className="max-w-[140px] font-mono"
                maxLength={7}
              />
              <Palette className="h-4 w-4 text-slate-500" />
            </div>
          </div>

          <div>
            <label className="text-label-upper mb-2 block">Tema</label>
            <div className="flex gap-2">
              <ThemeOption
                active={themeMode === 'dark'}
                onClick={() => setThemeMode('dark')}
                disabled={!isOwner}
                icon={Moon}
                label="Escuro"
              />
              <ThemeOption
                active={themeMode === 'light'}
                onClick={() => setThemeMode('light')}
                disabled={!isOwner}
                icon={Sun}
                label="Claro"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              O modo claro cobre a estrutura principal (menu, cabeçalho, cards, textos e botões).
              Algumas telas mais específicas ainda podem manter tons escuros — estamos migrando aos poucos.
            </p>
          </div>

          {isOwner && (
            <div className="flex items-center justify-end gap-2 pt-2">
              {updateBranding.isError && (
                <p className="text-xs text-accent-red">Erro ao salvar. Tente novamente.</p>
              )}
              {updateBranding.isSuccess && !updateBranding.isPending && (
                <p className="text-xs text-accent-green">Salvo!</p>
              )}
              <Button onClick={handleSave} loading={updateBranding.isPending} disabled={updateBranding.isPending}>
                {updateBranding.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar marca
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function BrandImageField({
  label,
  value,
  onUpload,
  onClear,
  disabled,
  round,
}: {
  label: string
  value: string | null
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  disabled: boolean
  round: boolean
}) {
  return (
    <div>
      <label className="text-label-upper mb-2 block">{label}</label>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-[rgba(59,130,246,0.2)] bg-surface-light/40 ${round ? 'rounded-full' : 'rounded-lg'}`}
        >
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-slate-500" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            className={`inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-[rgba(59,130,246,0.25)] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-[rgba(59,130,246,0.5)] hover:text-white ${disabled ? 'pointer-events-none opacity-50' : ''}`}
          >
            Enviar imagem
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={disabled} />
          </label>
          {value && !disabled && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-slate-500 hover:text-accent-red"
            >
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ThemeOption({
  active,
  onClick,
  disabled,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  disabled: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-[rgba(59,130,246,0.5)] bg-[rgba(59,130,246,0.1)] text-white'
          : 'border-[rgba(59,130,246,0.15)] text-slate-400 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
