// Browser file IO boundary: File -> bytes, bytes -> download, file pickers.
// Kept out of src/core so the document core stays DOM-free and unit-testable.

export async function fileToBytes(file: File | Blob): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

export function downloadBytes(
  bytes: Uint8Array | ArrayBuffer,
  filename: string,
  mime = 'application/pdf',
): void {
  const part: BlobPart = bytes instanceof Uint8Array ? (bytes.slice().buffer as ArrayBuffer) : bytes
  downloadBlob(new Blob([part], { type: mime }), filename)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after a tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export interface PickOptions {
  accept?: string
  multiple?: boolean
}

/** Opens the OS file picker and resolves with chosen files (empty if cancelled). */
export function pickFiles(opts: PickOptions = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (opts.accept) input.accept = opts.accept
    if (opts.multiple) input.multiple = true
    input.style.position = 'fixed'
    input.style.left = '-9999px'

    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish(input.files ? Array.from(input.files) : []))
    // If the user cancels there is no reliable event; resolve empty on next focus.
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish([]), 350),
      { once: true },
    )
    document.body.appendChild(input)
    input.click()
  })
}

export const ACCEPT_PDF = 'application/pdf,.pdf'
export const ACCEPT_IMAGE = 'image/png,image/jpeg,.png,.jpg,.jpeg'

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function isImageFile(file: File): boolean {
  return /^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name)
}

/** `report.pdf` -> `report-edited.pdf`; falls back gracefully for odd names. */
export function editedFilename(original: string, suffix = '-edited'): string {
  const base = original.replace(/\.pdf$/i, '')
  return `${base || 'document'}${suffix}.pdf`
}

export function withSuffix(original: string, suffix: string, ext = '.pdf'): string {
  const base = original.replace(/\.[^.]+$/, '')
  return `${base || 'document'}${suffix}${ext}`
}

/** Decodes an image's natural pixel size from its bytes. */
export function loadImageSize(
  bytes: Uint8Array,
  format: 'png' | 'jpg',
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const mime = format === 'png' ? 'image/png' : 'image/jpeg'
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }))
    const img = new Image()
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(out)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
