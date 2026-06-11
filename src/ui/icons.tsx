import type { JSX } from 'preact'

// Inline SVG icons (stroke = currentColor) so nothing is fetched at runtime.
type P = JSX.SVGAttributes<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: P & { children: preact.ComponentChildren }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </Svg>
)
export const IconFile = (p: P) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </Svg>
)
export const IconMerge = (p: P) => (
  <Svg {...p}>
    <path d="M7 3v6a4 4 0 0 0 4 4h6" />
    <path d="M7 21v-6" />
    <polyline points="14 10 17 13 14 16" />
  </Svg>
)
export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </Svg>
)
export const IconCompress = (p: P) => (
  <Svg {...p}>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </Svg>
)
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
)
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.2" y1="4.2" x2="5.6" y2="5.6" />
    <line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.2" y1="19.8" x2="5.6" y2="18.4" />
    <line x1="18.4" y1="5.6" x2="19.8" y2="4.2" />
  </Svg>
)
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
  </Svg>
)
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M3 7v6h6" />
    <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
  </Svg>
)
export const IconRedo = (p: P) => (
  <Svg {...p}>
    <path d="M21 7v6h-6" />
    <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
  </Svg>
)
export const IconSave = (p: P) => (
  <Svg {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </Svg>
)
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Svg>
)
export const IconZoomIn = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </Svg>
)
export const IconZoomOut = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </Svg>
)
export const IconFit = (p: P) => (
  <Svg {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </Svg>
)
export const IconRotateRight = (p: P) => (
  <Svg {...p}>
    <polyline points="21 7 21 3 17 3" />
    <path d="M21 3l-4.5 4.5" />
    <path d="M21 12a9 9 0 1 1-3-6.7" />
  </Svg>
)
export const IconRotateLeft = (p: P) => (
  <Svg {...p}>
    <polyline points="3 7 3 3 7 3" />
    <path d="M3 3l4.5 4.5" />
    <path d="M3 12a9 9 0 1 0 3-6.7" />
  </Svg>
)
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Svg>
)
export const IconDuplicate = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
)
export const IconClose = (p: P) => (
  <Svg {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
)
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
)
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <polyline points="15 18 9 12 15 6" />
  </Svg>
)
export const IconCursor = (p: P) => (
  <Svg {...p}>
    <path d="M3 3l7.07 17 2.51-7.39L20 10.07z" />
  </Svg>
)
export const IconText = (p: P) => (
  <Svg {...p}>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </Svg>
)
export const IconHighlight = (p: P) => (
  <Svg {...p}>
    <path d="M9 11l-4 4v3h3l4-4" />
    <path d="M13 7l4 4" />
    <path d="M15 5l4 4-7 7-4-4z" />
  </Svg>
)
export const IconPen = (p: P) => (
  <Svg {...p}>
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </Svg>
)
export const IconShapes = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="11" width="10" height="10" rx="1" />
    <circle cx="17" cy="7" r="4" />
  </Svg>
)
export const IconSquare = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
  </Svg>
)
export const IconCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
  </Svg>
)
export const IconLine = (p: P) => (
  <Svg {...p}>
    <line x1="5" y1="19" x2="19" y2="5" />
  </Svg>
)
export const IconArrow = (p: P) => (
  <Svg {...p}>
    <line x1="5" y1="19" x2="19" y2="5" />
    <polyline points="11 5 19 5 19 13" />
  </Svg>
)
export const IconWhiteout = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="7" width="18" height="10" rx="1" />
  </Svg>
)
export const IconSignature = (p: P) => (
  <Svg {...p}>
    <path d="M3 17c3 0 3-9 6-9s2 6 4 6 2-3 4-3 1 3 4 3" />
    <line x1="3" y1="21" x2="21" y2="21" />
  </Svg>
)
export const IconStamp = (p: P) => (
  <Svg {...p}>
    <path d="M5 21h14" />
    <path d="M9 7a3 3 0 1 1 6 0c0 2-2 3-2 5h-2c0-2-2-3-2-5z" />
    <path d="M6 17h12v-1a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3z" />
  </Svg>
)
export const IconHash = (p: P) => (
  <Svg {...p}>
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </Svg>
)
export const IconWatermark = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.7l5.5 6.2a7.3 7.3 0 1 1-11 0z" />
  </Svg>
)
export const IconCrop = (p: P) => (
  <Svg {...p}>
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
  </Svg>
)
export const IconScissors = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </Svg>
)
export const IconInsert = (p: P) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </Svg>
)
export const IconExtract = (p: P) => (
  <Svg {...p}>
    <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
    <polyline points="14 7 19 12 14 17" />
    <line x1="19" y1="12" x2="9" y2="12" />
  </Svg>
)
export const IconMenu = (p: P) => (
  <Svg {...p}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Svg>
)
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
)
export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Svg>
)
export const IconLayers = (p: P) => (
  <Svg {...p}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Svg>
)
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </Svg>
)
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
)
