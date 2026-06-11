export interface SavedSignature { dataUrl: string; bytes: Uint8Array; aspect: number }
const saved: SavedSignature[] = []
export function addSignature(s: SavedSignature): void { saved.unshift(s); if (saved.length > 8) saved.pop() }
export function getSignatures(): SavedSignature[] { return saved }
