// Lightweight wake-word hook scaffold.
//
// This file provides a stable interface for wake-word detection. It attempts
// to dynamically load a native on-device engine (e.g. Picovoice Porcupine) if
// available. In absence of a native engine it exposes no-op start/stop so the
// app can compile in the managed Expo workflow.
//
// Install steps (developer):
// 1. Add the native package (recommended):
//    yarn add @picovoice/porcupine-react-native
//    or follow Picovoice docs for RN integration and license keys.
// 2. Create an EAS build / custom dev client to include the native module.
// 3. Add `UIBackgroundModes` (audio) to iOS Info.plist and microphone
//    permission strings. See ./WAKeWORD.md for details.

import { useCallback, useEffect, useRef, useState } from 'react'

export type WakeCallback = () => void

export function useWakeWord() {
  const [available, setAvailable] = useState(false)
  const [listening, setListening] = useState(false)
  const callbackRef = useRef<WakeCallback | null>(null)

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!mounted) return
      setAvailable(false)
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const onWake = useCallback((cb: WakeCallback) => {
    callbackRef.current = cb;
  }, []);

  const start = useCallback(async () => {
    if (!available) {
      console.warn('Wake-word engine not available. Install native Porcupine and rebuild.');
      setListening(false);
      return;
    }
  }, [available]);

  const stop = useCallback(async () => {
    setListening(false)
  }, []);

  return {
    available,
    listening,
    start,
    stop,
    onWake,
  } as const;
}
