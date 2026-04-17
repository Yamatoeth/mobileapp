/**
 * Safe conversion of various buffer types to Uint8Array
 */

interface TypedArrayLike {
  buffer: ArrayBuffer
  byteOffset?: number
  byteLength?: number
}

export function toUint8Array(input: unknown): Uint8Array {
  if (!input) return new Uint8Array(0)
  
  // If already Uint8Array
  if (input instanceof Uint8Array) return input
  
  // ArrayBuffer
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  
  // Node Buffer-like or TypedArray-like
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>
    if ('buffer' in obj && obj.buffer instanceof ArrayBuffer) {
      const view = input as TypedArrayLike
      return new Uint8Array(
        view.buffer,
        view.byteOffset ?? 0,
        view.byteLength ?? (view.buffer.byteLength - (view.byteOffset ?? 0))
      )
    }
  }
  
  // TypedArray view (use isView if available)
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(input)) {
    const view = input as TypedArrayLike
    return new Uint8Array(
      view.buffer,
      view.byteOffset ?? 0,
      view.byteLength ?? (view.buffer.byteLength - (view.byteOffset ?? 0))
    )
  }
  
  // Fallback: try to create from Array.from
  try {
    return new Uint8Array(Array.from(input as Iterable<number>))
  } catch (_) {
    return new Uint8Array(0)
  }
}
