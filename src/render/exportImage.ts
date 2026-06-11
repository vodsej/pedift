import type { PageDescriptor } from '../core/types'
import type { RenderRegistry } from './registry'

export type ImageFormat = 'png' | 'jpg'

/** Renders a page descriptor to an offscreen canvas at the given scale (1 ≈ 72dpi). */
export async function renderDescriptorToCanvas(
  registry: RenderRegistry,
  descriptor: PageDescriptor,
  scale: number,
): Promise<HTMLCanvasElement> {
  const doc = await registry.get(descriptor.sourceId)
  const page = await doc.getPage(descriptor.srcIndex + 1)
  const viewport = page.getViewport({ scale, rotation: descriptor.rotation })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' } as any).promise
  // One-shot export: release the page's decoded resources.
  try {
    await page.cleanup()
  } catch {
    /* ignore */
  }
  return canvas
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality = 0.92,
): Promise<Blob> {
  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image export failed'))),
      mime,
      format === 'jpg' ? quality : undefined,
    )
  })
}

export async function descriptorToImageBlob(
  registry: RenderRegistry,
  descriptor: PageDescriptor,
  format: ImageFormat,
  scale: number,
): Promise<Blob> {
  const canvas = await renderDescriptorToCanvas(registry, descriptor, scale)
  return canvasToBlob(canvas, format)
}
