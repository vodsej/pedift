// Document core types. The editor state is a plain, serializable object derived
// by reducing an ordered command log (see commands.ts / history.ts). The save
// pipeline (save.ts) replays this state into a fresh pdf-lib document, so the
// loaded original is never mutated.

export type Rotation = 0 | 90 | 180 | 270

/** Crop in PDF points relative to the page's MediaBox (origin bottom-left). */
export interface CropBox {
  x: number
  y: number
  width: number
  height: number
}

/** A loaded byte source: the original PDF, an imported PDF, or an image. */
export interface SourceRef {
  id: string
  kind: 'pdf' | 'image'
  bytes: Uint8Array
  name: string
  /** Password needed to open this source (if it is encrypted). */
  password?: string
  /** Per-page /Rotate angles, so inserted pages keep their orientation. */
  pageRotations?: number[]
}

/** One page in the working document, pointing back at a source page. */
export interface PageDescriptor {
  id: string
  sourceId: string
  srcIndex: number
  rotation: Rotation
  crop: CropBox | null
}

// ---- Overlay objects (baked into page content on save) ----
// Geometry is stored in PDF points relative to the unrotated page, origin
// bottom-left, so baking is resolution/zoom independent.

export interface BaseObj {
  id: string
  pageId: string
  z: number
}
export interface TextObj extends BaseObj {
  type: 'text'
  x: number
  y: number // baseline-independent: y is the bottom of the text box
  width: number
  height: number
  text: string
  fontSize: number
  font: StandardFontName
  color: string // hex
  align: 'left' | 'center' | 'right'
}
export interface PenObj extends BaseObj {
  type: 'pen'
  points: Array<[number, number]> // PDF points
  color: string
  strokeWidth: number
}
export interface ShapeObj extends BaseObj {
  type: 'shape'
  shape: 'rect' | 'ellipse' | 'line' | 'arrow'
  x: number
  y: number
  width: number
  height: number
  color: string
  strokeWidth: number
  fill: string | null
}
export interface HighlightObj extends BaseObj {
  type: 'highlight'
  rects: CropBox[] // one per text run, PDF points
  color: string
  opacity: number
}
export interface WhiteoutObj extends BaseObj {
  type: 'whiteout'
  x: number
  y: number
  width: number
  height: number
  color: string // usually page background; defaults white
}
export interface ImageObj extends BaseObj {
  type: 'image'
  x: number
  y: number
  width: number
  height: number
  /** key into an image cache (data held separately so state stays light) */
  imageKey: string
  format: 'png' | 'jpg'
}
export interface SignatureObj extends BaseObj {
  type: 'signature'
  x: number
  y: number
  width: number
  height: number
  imageKey: string // PNG data of the drawn/typed signature
}
export interface StampObj extends BaseObj {
  type: 'stamp'
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  fontSize: number
}

export type OverlayObject =
  | TextObj
  | PenObj
  | ShapeObj
  | HighlightObj
  | WhiteoutObj
  | ImageObj
  | SignatureObj
  | StampObj

export type StandardFontName = 'Helvetica' | 'TimesRoman' | 'Courier'

export interface Metadata {
  title: string
  author: string
  subject: string
  keywords: string
}

export type PageNumberPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
export type PageNumberFormat = 'plain' | 'slash' | 'long'

export interface PageNumbersConfig {
  position: PageNumberPosition
  format: PageNumberFormat
  startAt: number
  /** 0-based inclusive range of working pages, or null for all. */
  range: [number, number] | null
  fontSize: number
  color: string
}

export interface WatermarkConfig {
  text: string
  color: string
  opacity: number
  fontSize: number
  range: [number, number] | null
}

export interface ProtectConfig {
  userPassword: string
  ownerPassword?: string
}

export interface OcrWord {
  text: string
  x: number // image px, top-left origin (over the rendered/rotated raster)
  y: number
  w: number
  h: number
}

export interface OcrPageData {
  words: OcrWord[]
  scale: number // render scale S: raster is the page rendered at S px per point of the ROTATED page
  rotation: Rotation // the page /Rotate applied when the raster was produced
  pageWidthPts: number // UNROTATED page width in points
  pageHeightPts: number // UNROTATED page height in points
}

export interface DocState {
  pages: PageDescriptor[]
  overlays: Record<string, OverlayObject[]>
  metadata: Metadata
  pageNumbers: PageNumbersConfig | null
  watermark: WatermarkConfig | null
  formValues: Record<string, string | boolean>
  flatten: boolean
  protect: ProtectConfig | null
  ocrData?: Record<string, OcrPageData> // keyed by pageId
}

export function emptyMetadata(): Metadata {
  return { title: '', author: '', subject: '', keywords: '' }
}
