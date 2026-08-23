import { useEffect, type ReactNode } from 'react'
import { useBranding } from '@/hooks/useBranding'

function hexToRgb(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m || !m[1] || !m[2] || !m[3]) return null
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`
}

function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m || !m[1] || !m[2] || !m[3]) return hex
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const rgb = [m[1], m[2], m[3]].map((h) => clamp(parseInt(h, 16) + amount))
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
}

/**
 * Aplica a identidade visual salva em fo_branding_settings ao documento:
 * título da aba, favicon, variáveis CSS de cor primária e classe de tema no
 * <html>. Roda em runtime (sem rebuild) — por isso cor/tema só alcançam as
 * superfícies que consomem var(--brand-*) ou a classe .light; a maior parte
 * das páginas ainda usa cores fixas (ver globals.css).
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data: branding } = useBranding()

  useEffect(() => {
    if (!branding) return

    if (branding.app_name) {
      document.title = branding.app_name
    }

    if (branding.favicon_url) {
      setFavicon(branding.favicon_url)
    }

    const root = document.documentElement
    const rgb = hexToRgb(branding.primary_color)
    root.style.setProperty('--brand-primary', branding.primary_color)
    root.style.setProperty('--brand-primary-light', shade(branding.primary_color, 40))
    root.style.setProperty('--brand-primary-dark', shade(branding.primary_color, -40))
    if (rgb) root.style.setProperty('--brand-primary-rgb', rgb)

    root.classList.toggle('light', branding.theme_mode === 'light')
    root.classList.toggle('dark', branding.theme_mode !== 'light')

    const themeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']")
    if (themeColorMeta) themeColorMeta.content = branding.primary_color
  }, [branding])

  return <>{children}</>
}
