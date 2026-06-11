/// <reference types="vite/client" />

// pdf.js worker imported as an inlined ES-module worker (see vite.config.ts).
declare module '*?worker&inline' {
  const workerConstructor: {
    new (options?: { name?: string }): Worker
  }
  export default workerConstructor
}
