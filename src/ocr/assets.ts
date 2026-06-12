import { WASM_GZ_B64 } from './vendor/wasm.gen'
import { ENG_GZ_B64 } from './vendor/eng.gen'
import { CES_GZ_B64 } from './vendor/ces.gen'
import { FONT_GZ_B64 } from './vendor/font.gen'

async function gunzipB64(b64: string): Promise<Uint8Array> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()
  const buf = await new Response(ds.readable).arrayBuffer()
  return new Uint8Array(buf)
}

// Simple module-level cache — decoded once per session.
let wasmBytes: Uint8Array | undefined
let engBytes: Uint8Array | undefined
let cesBytes: Uint8Array | undefined
let fontBytes: Uint8Array | undefined

export function getWasmBytes(): Promise<Uint8Array> {
  return wasmBytes ? Promise.resolve(wasmBytes) : gunzipB64(WASM_GZ_B64).then(b => (wasmBytes = b))
}

export function getEngTrainedData(): Promise<Uint8Array> {
  return engBytes ? Promise.resolve(engBytes) : gunzipB64(ENG_GZ_B64).then(b => (engBytes = b))
}

export function getCesTrainedData(): Promise<Uint8Array> {
  return cesBytes ? Promise.resolve(cesBytes) : gunzipB64(CES_GZ_B64).then(b => (cesBytes = b))
}

export function getFontBytes(): Promise<Uint8Array> {
  return fontBytes ? Promise.resolve(fontBytes) : gunzipB64(FONT_GZ_B64).then(b => (fontBytes = b))
}
