Wake-word integration guide

Overview

This project supports optional on-device wake-word detection ("Hey JARVIS").
Because this requires native code, the steps below show how to add Picovoice
(Porcupine) to the Expo app. If you remain in the managed workflow without a
custom dev client, the native module won't be available at runtime.

Recommended approach

1. Install the native package
   - yarn add @picovoice/porcupine-react-native
   - Follow the package docs for platform-specific steps.

2. Create a custom dev client or EAS build
   - Expo-managed apps need a custom dev client to include native modules.
   - See: https://docs.expo.dev/development/introduction/

3. iOS permissions & background modes
   - Edit ios/Medicus/Info.plist and add:
     <key>UIBackgroundModes</key>
     <array>
       <string>audio</string>
     </array>
   - Ensure microphone usage description exists:
     <key>NSMicrophoneUsageDescription</key>
     <string>Microphone access is required for voice commands.</string>

4. Android permissions
   - Add RECORD_AUDIO permission in AndroidManifest.xml and ensure
     background audio is permitted by your target API level. If using
     foreground service for continuous listening, configure it per docs.

5. Access key & keywords
   - Picovoice requires an access key and keyword files. Do NOT commit keys.
   - Provide `PICOVOICE_ACCESS_KEY` via secure env during EAS build or runtime
     config.

6. Hook usage (JS)
   - Import `useWakeWord` from `src/hooks/useWakeWord`.
   - Call `onWake(callback)` to register a wake callback.
   - Use `start()` to begin listening and `stop()` to stop.

7. Background listening
   - Continuous background wake-word listening requires platform-specific
     background audio handling and potentially a foreground service on Android.
   - Test carefully for battery impact and platform permission dialogs.

Notes & troubleshooting

- In development without a custom client the dynamic import of the native
  module will fail and `useWakeWord` will expose `available=false`.
- Follow the native package README for exact integration code — the JS hook
  here is a best-effort wrapper to keep app code stable before native
  installation.

If you want, I can:
- Add a small settings toggle UI wired to the hook.
- Attempt to patch Info.plist / AndroidManifest for you (I can create the
  changes, but you'll still need to rebuild with EAS).