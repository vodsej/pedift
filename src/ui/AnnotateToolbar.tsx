import { useState, useEffect, useRef } from 'preact/hooks'
import type { JSX } from 'preact'
import type { ToolId, ToolOptions } from '../overlay/tools'
import { IconButton, Button } from './components/Button'
import { ColorInput, Slider, Select, Field } from './components/controls'
import {
  IconCursor,
  IconText,
  IconReplace,
  IconHighlight,
  IconPen,
  IconShapes,
  IconSquare,
  IconCircle,
  IconLine,
  IconArrow,
  IconWhiteout,
  IconImage,
  IconSignature,
  IconStamp,
  IconCheck,
} from './icons'
import { t } from '../strings/en'
import './styles/annotate.css'

export interface AnnotateToolbarProps {
  tool: ToolId
  setTool: (t: ToolId) => void
  options: ToolOptions
  setOptions: (o: ToolOptions) => void
  onInsertImage: () => void
  onSignature: () => void
  onStamp: (text: string) => void
}

const SHAPE_TOOLS: ToolId[] = ['rect', 'ellipse', 'line', 'arrow']

function useOutsideClick(ref: { current: HTMLElement | null }, onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [active, onClose, ref])
}

function ShapesMenu({
  tool,
  setTool,
  onClose,
}: {
  tool: ToolId
  setTool: (t: ToolId) => void
  onClose: () => void
}) {
  const items: Array<{ id: ToolId; label: string; icon: JSX.Element }> = [
    { id: 'rect', label: t.tools.rectangle, icon: <IconSquare size={16} /> },
    { id: 'ellipse', label: t.tools.ellipse, icon: <IconCircle size={16} /> },
    { id: 'line', label: t.tools.line, icon: <IconLine size={16} /> },
    { id: 'arrow', label: t.tools.arrow, icon: <IconArrow size={16} /> },
  ]
  return (
    <div class="tool-menu" role="menu">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          class={`tool-menu__item${tool === item.id ? ' is-active' : ''}`}
          onClick={() => { setTool(item.id); onClose() }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

function StampMenu({ onStamp, onClose }: { onStamp: (text: string) => void; onClose: () => void }) {
  const items: Array<{ label: string; value: string }> = [
    { label: t.dialogs.stamp.approved, value: 'APPROVED' },
    { label: t.dialogs.stamp.draft, value: 'DRAFT' },
    { label: t.dialogs.stamp.confidential, value: 'CONFIDENTIAL' },
    { label: t.dialogs.stamp.check, value: '✓' },
    { label: t.dialogs.stamp.cross, value: '✗' },
    { label: t.dialogs.stamp.date, value: new Date().toLocaleDateString() },
  ]
  return (
    <div class="tool-menu" role="menu">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="menuitem"
          class="tool-menu__item"
          onClick={() => { onStamp(item.value); onClose() }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function ContextOptions({
  tool,
  options,
  setOptions,
}: {
  tool: ToolId
  options: ToolOptions
  setOptions: (o: ToolOptions) => void
}) {
  if (tool === 'text') {
    return (
      <div class="annotate-options">
        <Field label={t.tools.font}>
          <Select
            value={options.font}
            onChange={(v) => setOptions({ ...options, font: v as ToolOptions['font'] })}
            options={[
              { value: 'Helvetica', label: t.tools.fontHelvetica },
              { value: 'TimesRoman', label: t.tools.fontTimes },
              { value: 'Courier', label: t.tools.fontCourier },
            ]}
          />
        </Field>
        <Field label={t.tools.fontSize}>
          <Slider
            value={options.fontSize}
            min={8}
            max={72}
            onInput={(v) => setOptions({ ...options, fontSize: v })}
          />
          <span style="font-size:0.75rem;color:var(--text-muted);min-width:2ch">{options.fontSize}</span>
        </Field>
        <Field label={t.tools.color}>
          <ColorInput value={options.color} onChange={(v) => setOptions({ ...options, color: v })} />
        </Field>
      </div>
    )
  }

  if (tool === 'pen') {
    return (
      <div class="annotate-options">
        <Field label={t.tools.color}>
          <ColorInput value={options.color} onChange={(v) => setOptions({ ...options, color: v })} />
        </Field>
        <Field label={t.tools.strokeWidth}>
          <Slider
            value={options.strokeWidth}
            min={1}
            max={12}
            onInput={(v) => setOptions({ ...options, strokeWidth: v })}
          />
          <span style="font-size:0.75rem;color:var(--text-muted);min-width:2ch">{options.strokeWidth}</span>
        </Field>
      </div>
    )
  }

  if (tool === 'rect' || tool === 'ellipse') {
    const fillEnabled = options.fill !== null
    return (
      <div class="annotate-options">
        <Field label={t.tools.color}>
          <ColorInput value={options.color} onChange={(v) => setOptions({ ...options, color: v })} />
        </Field>
        <Field label={t.tools.strokeWidth}>
          <Slider
            value={options.strokeWidth}
            min={1}
            max={12}
            onInput={(v) => setOptions({ ...options, strokeWidth: v })}
          />
          <span style="font-size:0.75rem;color:var(--text-muted);min-width:2ch">{options.strokeWidth}</span>
        </Field>
        <Field label={t.tools.fill}>
          <Button
            size="sm"
            variant={fillEnabled ? 'primary' : 'ghost'}
            class="annotate-fill-toggle"
            onClick={() => setOptions({ ...options, fill: fillEnabled ? null : '#ffffff' })}
          >
            {fillEnabled ? <IconCheck size={14} /> : null}
            {t.tools.fill}
          </Button>
          {fillEnabled && (
            <ColorInput
              value={options.fill ?? '#ffffff'}
              onChange={(v) => setOptions({ ...options, fill: v })}
            />
          )}
        </Field>
      </div>
    )
  }

  if (tool === 'line' || tool === 'arrow') {
    return (
      <div class="annotate-options">
        <Field label={t.tools.color}>
          <ColorInput value={options.color} onChange={(v) => setOptions({ ...options, color: v })} />
        </Field>
        <Field label={t.tools.strokeWidth}>
          <Slider
            value={options.strokeWidth}
            min={1}
            max={12}
            onInput={(v) => setOptions({ ...options, strokeWidth: v })}
          />
          <span style="font-size:0.75rem;color:var(--text-muted);min-width:2ch">{options.strokeWidth}</span>
        </Field>
      </div>
    )
  }

  if (tool === 'highlight') {
    return (
      <div class="annotate-options">
        <Field label={t.tools.color}>
          <ColorInput
            value={options.highlightColor}
            onChange={(v) => setOptions({ ...options, highlightColor: v })}
          />
        </Field>
      </div>
    )
  }

  if (tool === 'whiteout') {
    return (
      <div class="annotate-options">
        <Field label={t.tools.color}>
          <ColorInput
            value={options.whiteoutColor}
            onChange={(v) => setOptions({ ...options, whiteoutColor: v })}
          />
        </Field>
      </div>
    )
  }

  return null
}

export function AnnotateToolbar(props: AnnotateToolbarProps): JSX.Element {
  const { tool, setTool, options, setOptions, onInsertImage, onSignature, onStamp } = props
  const [shapesOpen, setShapesOpen] = useState(false)
  const [stampOpen, setStampOpen] = useState(false)

  const shapesRef = useRef<HTMLDivElement>(null)
  const stampRef = useRef<HTMLDivElement>(null)

  useOutsideClick(shapesRef, () => setShapesOpen(false), shapesOpen)
  useOutsideClick(stampRef, () => setStampOpen(false), stampOpen)

  const shapesActive = SHAPE_TOOLS.includes(tool)

  return (
    <div class="annotate-toolbar" role="toolbar" aria-label={t.tools.annotationToolbarAriaLabel}>
      <IconButton
        label={t.tools.select}
        active={tool === 'select'}
        onClick={() => setTool('select')}
      >
        <IconCursor />
      </IconButton>

      <IconButton
        label={t.tools.text}
        active={tool === 'text'}
        onClick={() => setTool('text')}
      >
        <IconText />
      </IconButton>

      <IconButton
        label={t.tools.replaceText}
        active={tool === 'replaceText'}
        onClick={() => setTool('replaceText')}
      >
        <IconReplace />
      </IconButton>

      <IconButton
        label={t.tools.highlight}
        active={tool === 'highlight'}
        onClick={() => setTool('highlight')}
      >
        <IconHighlight />
      </IconButton>

      <IconButton
        label={t.tools.pen}
        active={tool === 'pen'}
        onClick={() => setTool('pen')}
      >
        <IconPen />
      </IconButton>

      <div class="tool-menu-wrap" ref={shapesRef}>
        <IconButton
          label={t.tools.shapes}
          active={shapesActive || shapesOpen}
          onClick={() => setShapesOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={shapesOpen}
        >
          <IconShapes />
        </IconButton>
        {shapesOpen && (
          <ShapesMenu
            tool={tool}
            setTool={setTool}
            onClose={() => setShapesOpen(false)}
          />
        )}
      </div>

      <div class="annotate-sep" aria-hidden="true" />

      <IconButton
        label={t.tools.whiteout}
        active={tool === 'whiteout'}
        onClick={() => setTool('whiteout')}
      >
        <IconWhiteout />
      </IconButton>

      <IconButton
        label={t.tools.image}
        active={tool === 'image'}
        onClick={onInsertImage}
      >
        <IconImage />
      </IconButton>

      <IconButton
        label={t.tools.signature}
        active={tool === 'signature'}
        onClick={onSignature}
      >
        <IconSignature />
      </IconButton>

      <div class="tool-menu-wrap" ref={stampRef}>
        <IconButton
          label={t.tools.stamp}
          active={tool === 'stamp' || stampOpen}
          onClick={() => setStampOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={stampOpen}
        >
          <IconStamp />
        </IconButton>
        {stampOpen && (
          <StampMenu
            onStamp={onStamp}
            onClose={() => setStampOpen(false)}
          />
        )}
      </div>

      <ContextOptions tool={tool} options={options} setOptions={setOptions} />
    </div>
  )
}
