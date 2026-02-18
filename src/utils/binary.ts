export function toUint8Array(input: any): Uint8Array {
  if (!input) return new Uint8Array(0)
  // If already Uint8Array
  if (input instanceof Uint8Array) return input
  // ArrayBuffer
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  // Node Buffer-like
  if (typeof input === 'object' && 'buffer' in input && input.buffer instanceof ArrayBuffer) {
    return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || (input.buffer.byteLength - (input.byteOffset || 0)))
  }
  // TypedArray view
  if (ArrayBuffer.isView && ArrayBuffer.isView(input)) {
    return new Uint8Array((input as any).buffer, (input as any).byteOffset || 0, (input as any).byteLength || ((input as any).buffer.byteLength - ((input as any).byteOffset || 0)))
  }
  // Fallback: try to create from Array.from
  try {
    return new Uint8Array(Array.from(input))
  } catch (_) {
    return new Uint8Array(0)
  }
}
