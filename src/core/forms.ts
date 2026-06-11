import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
} from '@cantoo/pdf-lib'
import { classifyError, PdfError } from './errors'

export type FieldType = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'optionlist' | 'other'

export interface FieldInfo {
  name: string
  type: FieldType
  value: string | boolean
  options?: string[]
}

async function load(bytes: Uint8Array, password?: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { password, updateMetadata: false })
  } catch (err) {
    throw classifyError(err)
  }
}

/** Describe the fillable form fields in a PDF (empty array if there is no form). */
export async function detectFields(bytes: Uint8Array, password?: string): Promise<FieldInfo[]> {
  const doc = await load(bytes, password)
  let fields
  try {
    fields = doc.getForm().getFields()
  } catch {
    return []
  }
  return fields.map((f): FieldInfo => {
    const name = f.getName()
    if (f instanceof PDFTextField) return { name, type: 'text', value: f.getText() ?? '' }
    if (f instanceof PDFCheckBox) return { name, type: 'checkbox', value: f.isChecked() }
    if (f instanceof PDFDropdown)
      return { name, type: 'dropdown', value: f.getSelected()[0] ?? '', options: f.getOptions() }
    if (f instanceof PDFOptionList)
      return { name, type: 'optionlist', value: f.getSelected()[0] ?? '', options: f.getOptions() }
    if (f instanceof PDFRadioGroup)
      return { name, type: 'radio', value: f.getSelected() ?? '', options: f.getOptions() }
    return { name, type: 'other', value: '' }
  })
}

export interface ApplyFormOptions {
  flatten?: boolean
}

/** Fill the given field values into a PDF, optionally flattening, and return new bytes. */
export async function applyFormValues(
  bytes: Uint8Array,
  password: string | undefined,
  values: Record<string, string | boolean>,
  opts: ApplyFormOptions = {},
): Promise<Uint8Array> {
  const doc = await load(bytes, password)
  const form = doc.getForm()

  for (const [name, value] of Object.entries(values)) {
    let field
    try {
      field = form.getField(name)
    } catch {
      continue
    }
    try {
      if (field instanceof PDFTextField) field.setText(String(value ?? ''))
      else if (field instanceof PDFCheckBox) value ? field.check() : field.uncheck()
      else if (field instanceof PDFDropdown && value) field.select(String(value))
      else if (field instanceof PDFOptionList && value) field.select(String(value))
      else if (field instanceof PDFRadioGroup && value) field.select(String(value))
    } catch {
      /* skip fields that reject the value */
    }
  }

  if (opts.flatten) {
    try {
      form.flatten()
    } catch (err) {
      throw new PdfError('save-failed', 'Could not flatten the form', err)
    }
  }
  return doc.save()
}

/** Flatten all form fields + annotations into static page content. */
export async function flattenDocument(bytes: Uint8Array, password?: string): Promise<Uint8Array> {
  const doc = await load(bytes, password)
  try {
    doc.getForm().flatten()
  } catch {
    /* no form is fine */
  }
  return doc.save()
}
