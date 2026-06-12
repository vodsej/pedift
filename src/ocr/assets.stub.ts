// Stub module for the lean (non-OCR) edition.
// A Vite alias swaps this in place of assets.ts to keep multi-MB base64 out
// of the standard bundle. Signatures are identical to assets.ts.

export function getWasmBytes(): Promise<Uint8Array> {
  throw new Error('OCR assets are not available in this edition')
}

export function getEngTrainedData(): Promise<Uint8Array> {
  throw new Error('OCR assets are not available in this edition')
}

export function getCesTrainedData(): Promise<Uint8Array> {
  throw new Error('OCR assets are not available in this edition')
}

export function getFontBytes(): Promise<Uint8Array> {
  throw new Error('OCR assets are not available in this edition')
}
