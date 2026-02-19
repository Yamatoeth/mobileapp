import { toUint8Array } from './binary'
import { Skia } from '@shopify/react-native-skia'

function arrayBufferForUint8(u8?: Uint8Array | null): ArrayBuffer | null {
  if (!u8) return null
  // If view covers full buffer, return underlying buffer directly
  if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) return u8.buffer instanceof ArrayBuffer ? u8.buffer : null
  // Otherwise return a compacted slice matching the view's bytes
  return u8.buffer instanceof ArrayBuffer
    ? u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
    : null
}

function wrapMakePicture() {
  try {
    const Picture: any = (Skia as any)?.Picture
    if (!Picture) return
    const orig = Picture.MakePicture || Picture.Make
    if (typeof orig !== 'function') return
    const name = Picture.MakePicture ? 'MakePicture' : 'Make'
    // Wrap only once
    if ((orig as any).__wrapped_by_skiaSafe) return

    const wrapped = function (this: any, data: any, ...args: any[]) {
      // Ensure first arg is an ArrayBuffer (Skia JSI expects ArrayBuffer)
      const u8 = toUint8Array(data)
      const ab = arrayBufferForUint8(u8) ?? (u8 as any)
      // Debug: log shape of incoming buffer/view
      // eslint-disable-next-line no-console
      console.log('[skiaSafe] MakePicture input', {
        isView: !!(u8 && u8.buffer),
        byteOffset: u8?.byteOffset,
        byteLength: u8?.byteLength,
        bufferByteLength: u8?.buffer?.byteLength,
      })
      return orig.call(this, ab, ...args)
    }
    ;(wrapped as any).__wrapped_by_skiaSafe = true
    Picture[name] = wrapped
  } catch (e) {
    // Do nothing if Skia internals aren't present or API differs
    // eslint-disable-next-line no-console
    console.warn('[skiaSafe] failed to wrap MakePicture', e)
  }
}

// Also wrap Data.MakeFromBytes or similar if present
function wrapDataMakeFromBytes() {
  try {
    const Data: any = (Skia as any)?.Data
    if (!Data) return
    const orig = Data.MakeFromBytes || Data.Make
    if (typeof orig !== 'function') return
    if ((orig as any).__wrapped_by_skiaSafe) return
    const wrapped = function (this: any, data: any, ...args: any[]) {
      const u8 = toUint8Array(data)
      const ab = arrayBufferForUint8(u8) ?? (u8 as any)
      // eslint-disable-next-line no-console
      console.log('[skiaSafe] Data.MakeFromBytes input', {
        byteOffset: u8?.byteOffset,
        byteLength: u8?.byteLength,
      })
      return orig.call(this, ab, ...args)
    }
    ;(wrapped as any).__wrapped_by_skiaSafe = true
    if (Data.MakeFromBytes) Data.MakeFromBytes = wrapped
    else if (Data.Make) Data.Make = wrapped
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[skiaSafe] failed to wrap Data.MakeFromBytes', e)
  }
}

// Wrap Image.MakeImageFromEncoded / MakeFromEncoded if present
function wrapImageMakeFromEncoded() {
  try {
    const Image: any = (Skia as any)?.Image
    if (!Image) return
    const orig1 = Image.MakeImageFromEncoded || Image.MakeFromEncoded || Image.Make
    if (typeof orig1 !== 'function') return
    if ((orig1 as any).__wrapped_by_skiaSafe) return
    const wrapped = function (this: any, data: any, ...args: any[]) {
      const u8 = toUint8Array(data)
      const ab = arrayBufferForUint8(u8) ?? (u8 as any)
      // eslint-disable-next-line no-console
      console.log('[skiaSafe] Image.MakeFromEncoded input', {
        byteOffset: u8?.byteOffset,
        byteLength: u8?.byteLength,
      })
      return orig1.call(this, ab, ...args)
    }
    ;(wrapped as any).__wrapped_by_skiaSafe = true
    if (Image.MakeImageFromEncoded) Image.MakeImageFromEncoded = wrapped
    else if (Image.MakeFromEncoded) Image.MakeFromEncoded = wrapped
    else if (Image.Make) Image.Make = wrapped
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[skiaSafe] failed to wrap Image.MakeImageFromEncoded', e)
  }
}

// Run wrappers at import time
wrapMakePicture()
wrapDataMakeFromBytes()
wrapImageMakeFromEncoded()

export default {
  wrapMakePicture,
  wrapDataMakeFromBytes,
}
