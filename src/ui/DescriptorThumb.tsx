import { useEffect, useRef, useState } from 'preact/hooks'
import type { PageDescriptor } from '../core/types'
import type { RenderRegistry } from '../render/registry'
import { renderThumbnail } from '../render/thumbnail'

const THUMB_WIDTH = 150

/** Renders a thumbnail for a page descriptor (resolving its source + rotation). */
export function DescriptorThumb({
  registry,
  descriptor,
}: {
  registry: RenderRegistry
  descriptor: PageDescriptor
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setVisible(true),
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    registry
      .get(descriptor.sourceId)
      .then((doc) => doc.getPage(descriptor.srcIndex + 1))
      .then((page) => {
        if (cancelled || !ref.current) return
        return renderThumbnail(page, ref.current, THUMB_WIDTH, descriptor.rotation)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [visible, registry, descriptor.sourceId, descriptor.srcIndex, descriptor.rotation])

  return (
    <div ref={wrapRef} class="dthumb__frame">
      <canvas ref={ref} class="dthumb__canvas" />
    </div>
  )
}
