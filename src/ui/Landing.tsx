import { DropZone } from './components/DropZone'
import { Spinner } from './components/Spinner'
import { ThemeToggle } from './ThemeToggle'
import {
  IconUpload,
  IconMerge,
  IconImage,
  IconCompress,
  IconLock,
  IconShield,
  IconDownload,
} from './icons'
import type { Theme } from './theme'
import { t } from '../strings/en'
import { downloadBlob } from '../io/fileio'
import logoUrl from './assets/logo.png'

export type QuickToolId = 'merge' | 'images' | 'compress' | 'protect'

interface Props {
  theme: Theme
  onToggleTheme: () => void
  onOpenFile: (file: File) => void
  opening: boolean
  onQuickTool?: (id: QuickToolId) => void
}

const TOOLS: Array<{ id: QuickToolId; icon: preact.ComponentChildren; title: string; desc: string }> = [
  { id: 'merge', icon: <IconMerge size={24} />, title: t.quickTools.merge.title, desc: t.quickTools.merge.desc },
  { id: 'images', icon: <IconImage size={24} />, title: t.quickTools.imagesToPdf.title, desc: t.quickTools.imagesToPdf.desc },
  { id: 'compress', icon: <IconCompress size={24} />, title: t.quickTools.compress.title, desc: t.quickTools.compress.desc },
  { id: 'protect', icon: <IconLock size={24} />, title: t.quickTools.protect.title, desc: t.quickTools.protect.desc },
]

async function handleSavePage() {
  let html: string
  try {
    // Prefer the pristine document the server delivered: a byte-identical copy
    // of the build with no transient rendered state, and the theme bootstrap
    // intact so reopening picks the right theme. Reading our own URL keeps
    // everything on-device — no user data is sent.
    const res = await fetch(document.location.href)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch {
    // file:// or networking disabled: serialize the live DOM. The built single
    // file inlines all CSS/JS statically, so this still round-trips offline.
    html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML
  }
  const blob = new Blob([html], { type: 'text/html' })
  downloadBlob(blob, 'pedift.html')
}

export function Landing({ theme, onToggleTheme, onOpenFile, opening, onQuickTool }: Props) {
  return (
    <div class="landing">
      <header class="landing__top">
        <div class="brand">
          <img class="brand__mark" src={logoUrl} width={32} height={32} alt="" />
          <span class="brand__name">{t.appName}</span>
        </div>
        <div class="landing__top-right">
          <span class="privacy-badge" data-tooltip={t.privacy.line}>
            <IconShield size={15} /> {t.privacy.badge}
          </span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      <main class="landing__main">
        <h1 class="landing__title">{t.tagline}</h1>
        <p class="landing__subtitle">{t.privacy.line}</p>

        <DropZone
          accept="pdf"
          onFiles={(files) => files[0] && onOpenFile(files[0])}
          activeLabel={t.landing.dropActive}
          class="landing__drop"
        >
          {opening ? (
            <Spinner size={36} label={t.common.loading} />
          ) : (
            <>
              <span class="dropzone__icon">
                <IconUpload size={40} />
              </span>
              <span class="dropzone__title">{t.landing.dropTitle}</span>
              <span class="dropzone__hint">{t.landing.dropHint}</span>
            </>
          )}
        </DropZone>

        <section class="quicktools">
          <div class="quicktools__head">
            <h2 class="quicktools__title">{t.landing.quickToolsTitle}</h2>
            <p class="quicktools__hint">{t.landing.quickToolsHint}</p>
          </div>
          <div class="quicktools__grid">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                class="tool-tile"
                onClick={() => onQuickTool?.(tool.id)}
                disabled={!onQuickTool}
              >
                <span class="tool-tile__icon">{tool.icon}</span>
                <span class="tool-tile__title">{tool.title}</span>
                <span class="tool-tile__desc">{tool.desc}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer class="landing__foot">
        <span>{t.privacy.line}</span>
        <span class="landing__sep" aria-hidden="true"></span>
        <button type="button" class="landing__save-btn" onClick={handleSavePage}>
          <IconDownload size={13} />{t.landing.saveThisPage}
        </button>
      </footer>
    </div>
  )
}
