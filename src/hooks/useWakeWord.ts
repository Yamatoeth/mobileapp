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

import { useCallback, useEffect, useRef, useState } from "react";

export type WakeCallback = () => void;

export function useWakeWord() {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const engineRef = useRef<any>(null);
  const callbackRef = useRef<WakeCallback | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Try to dynamically import the native Porcupine module if present.
        // This keeps the JS bundle runnable even without the native dependency.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = await import('@picovoice/porcupine-react-native');
        if (!mounted) return;
        engineRef.current = mod;
        setAvailable(true);
      } catch (err) {
        // Not available in this environment — log for developers.
        // console.warn('Wake-word engine not available:', err);
        setAvailable(false);
      }
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

    try {
      const porcupine = engineRef.current;
      if (!porcupine) return;

      // The native API differs; this is a best-effort wrapper that assumes
      // the typical Porcupine RN usage. Developers should adapt to the
      // exact API after installing the native module.
      if (porcupine.PorcupineManager) {
        // Example expected API (porcupine-react-native):
        // const manager = await porcupine.PorcupineManager.fromKeywordPaths(accessKey, [keywordPath], [sensitivity]);
        // manager.start((keywordIndex) => { callbackRef.current?.(); });
        // Save manager to engineRef.current.manager
        const accessKey = process.env.PICOVOICE_ACCESS_KEY || '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const manager: any = await porcupine.PorcupineManager.fromKeywordPaths(accessKey, [], []);
        // store manager
        engineRef.current.manager = manager;
        manager.start((keywordIndex: number) => {
          callbackRef.current?.();
        });
        setListening(true);
        return;
      }

      // If module exposes a simple `start` function
      if (typeof porcupine.start === 'function') {
        porcupine.start((idx: number) => callbackRef.current?.());
        setListening(true);
        return;
      }

      console.warn('Wake-word native module loaded but API is unexpected.');
    } catch (err) {
      console.error('Failed to start wake-word engine:', err);
      setListening(false);
    }
  }, [available]);

  const stop = useCallback(async () => {
    try {
      const porcupine = engineRef.current;
      if (!porcupine) {
        setListening(false);
        return;
      }

      if (porcupine.PorcupineManager && porcupine.manager) {
        await porcupine.manager.stop();
        await porcupine.manager.release();
      } else if (typeof porcupine.stop === 'function') {
        porcupine.stop();
      }
    } catch (err) {
      console.error('Failed to stop wake-word engine:', err);
    } finally {
      setListening(false);
    }
  }, []);

  return {
    available,
    listening,
    start,
    stop,
    onWake,
  } as const;
}
