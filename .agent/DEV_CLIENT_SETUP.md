Dev Client & Native Modules Setup
=================================

Quick steps to build a development client and fix native-module runtime errors (Reanimated, Skia, Expo audio/video):

1) Install native deps (already done via `expo install` for this repo):

   ```bash
   npx expo install react-native-reanimated react-native-gesture-handler @shopify/react-native-skia expo-audio expo-video
   ```

2) Clear Metro cache and restart:

   ```bash
   expo start -c
   ```

3) If you see `react-native-reanimated is not installed` in Expo Go, you must use a custom dev client or prebuild:

   ```bash
   npx expo prebuild --no-install
   # then build a development client (iOS/Android)
   npx eas build --profile development --platform ios
   npx eas build --profile development --platform android
   # or run locally (requires native toolchains):
   npx expo run:ios
   npx expo run:android
   ```

4) Rebuild after installing native packages. Restart the dev client/device after each native change.

Notes:
- `expo-audio` / `expo-video` replace `expo-av` subsets — this project includes a compatibility wrapper `src/services/audioCompat.ts` so code runs with either package during migration.
- For `react-native-reanimated`, ensure `babel.config.js` includes `'react-native-reanimated/plugin'` as last plugin (this repo already has it). A full app restart is required after installing Reanimated.
