import { toUint8Array } from './binary'
import { Skia } from '@shopify/react-native-skia'

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
      const ab = u8 && u8.buffer ? u8.buffer : u8
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
      const ab = u8 && u8.buffer ? u8.buffer : u8
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
      const ab = u8 && u8.buffer ? u8.buffer : u8
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
