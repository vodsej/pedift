import { useEffect, useRef, useState } from 'preact/hooks'
import { Button } from './components/Button'
import {
  IconMenu,
  IconText,
  IconCrop,
  IconWatermark,
  IconHash,
  IconLock,
  IconCompress,
  IconLayers,
  IconInfo,
  IconOcr,
} from './icons'
import { t } from '../strings'

export type DocAction =
  | 'forms'
  | 'flatten'
  | 'ocr'
  | 'metadata'
  | 'crop'
  | 'watermark'
  | 'pagenumbers'
  | 'protect'
  | 'compress'

interface Item {
  action: DocAction
  label: string
  icon: preact.ComponentChildren
}

export function DocumentMenu({ onSelect }: { onSelect: (a: DocAction) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const items: Item[] = [
    { action: 'forms', label: t.documentMenu.fillForms, icon: <IconText size={17} /> },
    { action: 'flatten', label: t.documentMenu.flatten, icon: <IconLayers size={17} /> },
    // OCR sits with the other document-content operations (OCR edition only). The
    // `__OCR__ ? […] : []` spread is dead-code-eliminated from the lean build, so
    // IconOcr is tree-shaken there.
    ...(__OCR__ ? [{ action: 'ocr' as const, label: t.documentMenu.ocr, icon: <IconOcr size={17} /> }] : []),
    { action: 'crop', label: t.pagesPanel.crop, icon: <IconCrop size={17} /> },
    { action: 'watermark', label: t.tools.watermark, icon: <IconWatermark size={17} /> },
    { action: 'pagenumbers', label: t.tools.pageNumbers, icon: <IconHash size={17} /> },
    { action: 'metadata', label: t.documentMenu.metadata, icon: <IconInfo size={17} /> },
    { action: 'compress', label: t.documentMenu.compress, icon: <IconCompress size={17} /> },
    { action: 'protect', label: t.documentMenu.protect, icon: <IconLock size={17} /> },
  ]

  return (
    <div class="docmenu" ref={ref}>
      <Button variant="secondary" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <IconMenu size={18} /> {t.workspace.documentMenu}
      </Button>
      {open && (
        <div class="docmenu__list" role="menu">
          {items.map((it) => (
            <button
              key={it.action}
              type="button"
              role="menuitem"
              class="docmenu__item"
              onClick={() => {
                setOpen(false)
                onSelect(it.action)
              }}
            >
              <span class="docmenu__icon">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
