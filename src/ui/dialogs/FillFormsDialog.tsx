import { useState, useEffect } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import type { RenderRegistry } from '../../render/registry'
import type { FieldInfo } from '../../core/forms'
import { detectFields, applyFormValues } from '../../core/forms'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { TextInput, Select } from '../components/controls'
import { Spinner } from '../components/Spinner'
import { IconCheck } from '../icons'
import { toast } from '../toast'
import { friendlyMessage } from '../../core/errors'
import { t } from '../../strings'
import '../styles/docdialogs.css'

export function FillFormsDialog({
  editor,
  registry,
  onClose,
}: {
  editor: EditorDocument
  registry: RenderRegistry
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const source = editor.getSource('original')
    if (!source) {
      setLoading(false)
      return
    }
    detectFields(source.bytes, source.password)
      .then((detected) => {
        if (cancelled) return
        setFields(detected)
        const init: Record<string, string | boolean> = {}
        for (const f of detected) {
          init[f.name] = f.value
        }
        setValues(init)
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(friendlyMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [editor])

  const setValue = (name: string, val: string | boolean) => {
    setValues((prev) => ({ ...prev, [name]: val }))
  }

  const apply = async () => {
    const source = editor.getSource('original')
    if (!source) return
    setBusy(true)
    try {
      const result = await applyFormValues(source.bytes, source.password ?? '', values, {
        flatten: true,
      })
      await editor.rebase(result)
      await registry.evict('original')
      toast.success(t.dialogs.fillForms.applied)
      onClose()
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const renderFieldControl = (field: FieldInfo) => {
    if (field.type === 'checkbox') {
      return (
        <div class="form-field-row form-field-row--checkbox">
          <input
            type="checkbox"
            id={`ff-${field.name}`}
            checked={values[field.name] === true}
            onChange={(e) => setValue(field.name, (e.target as HTMLInputElement).checked)}
            aria-label={field.name}
          />
          <label class="form-field-row__label" for={`ff-${field.name}`}>
            {field.name}
          </label>
        </div>
      )
    }

    if (
      (field.type === 'dropdown' || field.type === 'optionlist' || field.type === 'radio') &&
      field.options &&
      field.options.length > 0
    ) {
      return (
        <div class="form-field-row">
          <span class="form-field-row__label">{field.name}</span>
          <Select
            value={String(values[field.name] ?? '')}
            onChange={(v) => setValue(field.name, v)}
            options={field.options.map((o) => ({ value: o, label: o }))}
            aria-label={field.name}
          />
        </div>
      )
    }

    return (
      <div class="form-field-row">
        <span class="form-field-row__label">{field.name}</span>
        <TextInput
          value={String(values[field.name] ?? '')}
          onInput={(e) => setValue(field.name, (e.target as HTMLInputElement).value)}
          aria-label={field.name}
        />
      </div>
    )
  }

  return (
    <Dialog
      title={t.dialogs.fillForms.title}
      onClose={onClose}
      locked={busy}
      icon={<IconCheck size={18} />}
      footer={
        loading || fields.length === 0 ? (
          <Button onClick={onClose}>{t.common.close}</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={busy}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={apply} disabled={busy}>
              {t.dialogs.fillForms.saveButton}
            </Button>
          </>
        )
      }
    >
      {loading && (
        <div class="qt-busy">
          <Spinner size={22} label={t.common.loading} />
        </div>
      )}

      {!loading && fields.length === 0 && (
        <p class="qt-hint">{t.dialogs.fillForms.none}</p>
      )}

      {!loading && fields.length > 0 && (
        <div class="form-field-list" aria-label={t.dialogs.fillForms.title}>
          {fields.map((field) => renderFieldControl(field))}
        </div>
      )}
    </Dialog>
  )
}
