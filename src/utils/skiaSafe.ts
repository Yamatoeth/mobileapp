import { toUint8Array } from './binary'
import { Skia } from '@shopify/react-native-skia'

/**
 * Skia JSI module interface for type-safe bindings
 */
type SkiaJSIFunction = ((this: unknown, ...args: unknown[]) => unknown) & {
  __wrapped_by_skiaSafe?: boolean
}

interface SkiaPictureModule {
  MakePicture?: SkiaJSIFunction
  Make?: SkiaJSIFunction
}

interface SkiaDataModule {
  MakeFromBytes?: SkiaJSIFunction
  Make?: SkiaJSIFunction
}

interface SkiaImageModule {
  MakeImageFromEncoded?: SkiaJSIFunction
  MakeFromEncoded?: SkiaJSIFunction
  Make?: SkiaJSIFunction
}

interface SkiaModule {
  Picture?: SkiaPictureModule
  Data?: SkiaDataModule
  Image?: SkiaImageModule
}

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
    const skiaTyped = Skia as unknown as SkiaModule
    const Picture = skiaTyped?.Picture
    if (!Picture) return
    const orig = Picture.MakePicture || Picture.Make
    if (typeof orig !== 'function') return
    const name = Picture.MakePicture ? 'MakePicture' : 'Make'
    // Wrap only once
    if (orig.__wrapped_by_skiaSafe) return

    const wrapped = function (this: unknown, data: unknown, ...args: unknown[]) {
      // Ensure first arg is an ArrayBuffer (Skia JSI expects ArrayBuffer)
      const u8 = toUint8Array(data)
      const ab = arrayBufferForUint8(u8) ?? u8
      // Debug: log shape of incoming buffer/view
      console.log('[skiaSafe] MakePicture input', {
        isView: !!(u8 && u8.buffer),
        byteOffset: u8?.byteOffset,
        byteLength: u8?.byteLength,
        bufferByteLength: u8?.buffer?.byteLength,
      })
      return orig.call(this, ab, ...args)
    }
    ;(wrapped as unknown as SkiaJSIFunction).__wrapped_by_skiaSafe = true
    Picture[name] = wrapped as SkiaJSIFunction
  } catch (e) {
    // Do nothing if Skia internals aren't present or API differs
    console.warn('[skiaSafe] failed to wrap MakePicture', e)
  }
}

// Also wrap Data.MakeFromBytes or similar if present
function wrapDataMakeFromBytes() {
  try {
    const skiaTyped = Skia as unknown as SkiaModule
    const Data = skiaTyped?.Data
    if (!Data) return
    const orig = Data.MakeFromBytes || Data.Make
    if (typeof orig !== 'function') return
    if (orig.__wrapped_by_skiaSafe) return
    const wrapped = function (this: unknown, data: unknown, ...args: unknown[]) {
      const u8 = toUint8Array(data)
      const ab = arrayBufferForUint8(u8) ?? u8
      console.log('[skiaSafe] Data.MakeFromBytes input', {
        byteOffset: u8?.byteOffset,
        byteLength: u8?.byteLength,
      })
      return orig.call(this, ab, ...args)
    }
    ;(wrapped as unknown as SkiaJSIFunction).__wrapped_by_skiaSafe = true
    if (Data.MakeFromBytes) Data.MakeFromBytes = wrapped as SkiaJSIFunction
    else if (Data.Make) Data.Make = wrapped as SkiaJSIFunction
  } catch (e) {
    console.warn('[skiaSafe] failed to wrap Data.MakeFromBytes', e)
  }
}

// Wrap Image.MakeImageFromEncoded / MakeFromEncoded if present
function wrapImageMakeFromEncoded() {
  try {
    const skiaTyped = Skia as unknown as SkiaModule
    const Image = skiaTyped?.Image
    if (!Image) return
    const orig1 = Image.MakeImageFromEncoded || Image.MakeFromEncoded || Image.Make
    if (typeof orig1 !== 'function') return
    if (orig1.__wrapped_by_skiaSafe) return
    const wrapped = function (this: unknown, data: unknown, ...args: unknown[]) {
      const u8 = toUint8Array(data)
      const ab = arrayBufferForUint8(u8) ?? u8
      console.log('[skiaSafe] Image.MakeFromEncoded input', {
        byteOffset: u8?.byteOffset,
        byteLength: u8?.byteLength,
      })
      return orig1.call(this, ab, ...args)
    }
    ;(wrapped as unknown as SkiaJSIFunction).__wrapped_by_skiaSafe = true
    if (Image.MakeImageFromEncoded) Image.MakeImageFromEncoded = wrapped as SkiaJSIFunction
    else if (Image.MakeFromEncoded) Image.MakeFromEncoded = wrapped as SkiaJSIFunction
    else if (Image.Make) Image.Make = wrapped as SkiaJSIFunction
  } catch (e) {
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
